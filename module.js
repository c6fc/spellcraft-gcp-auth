'use strict';

const { google } = require('googleapis');
const { GoogleAuth, Impersonated } = require('google-auth-library');

let auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

let projectId = null;
let client = null;

exports._spellcraft_metadata = {
	functionContext: { google },

	// Extend the SpellCraft `yargs` to include whatever custom interactions with `spellframe` you want.
	cliExtensions: (yargs, spellframe) => {
		yargs
		.command("gcp-identity", "Display the GCP identity of the SpellCraft execution context", (yargs) => yargs, async (argv) => {

			await spellframe.init();
			console.log(await verifyCredentials());

		});

		console.log(`[+] Imported SpellFrame CLI extensions for @c6fc/spellcraft-gcp-auth`);
	},
	init: async () => {
		await setGcpCredentials();
	}
};

async function verifyCredentials() {
    try {
        // Initialize the OAuth2 client
        const oauth2 = google.oauth2({ version: 'v2', auth: client });
        
        // This endpoint verifies the current token and returns details about the holder
        const res = await oauth2.tokeninfo();
        const data = res.data;

        return {
            identity: data.email || process.env.SPELLFRAME_GCP_IMPERSONATE,
            projectId,
            scopes: data.scope.split(' '),
            expiresIn: data.expires_in,
            // Determine type based on properties or envvars
            authType: process.env.SPELLFRAME_GCP_IMPERSONATE ? 'Impersonated Service Account' :
                      (data.email.endsWith('.gserviceaccount.com') ? 'Service Account' : 'User/Authorized Account'),
            impersonatedBy: process.env.SPELLFRAME_GCP_IMPERSONATE ? 'Local ADC/Key' : null
        };
    } catch (e) {
        throw new Error(`Failed to verify GCP credentials: ${e.message}`);
    }
}

exports.getCallerIdentity = [verifyCredentials];
exports.getProjectMetadata = [getProjectMetadata];

exports.enableServices = [async function(services) {
    return await enableServices(JSON.parse(services))
}, "services"];

async function setGcpCredentials() {
	const initialClient = await auth.getClient();
        
    // If this envvar is set, we wrap the credentials to act as another identity
    const targetAccount = process.env.SPELLFRAME_GCP_IMPERSONATE;
    
    if (targetAccount) {
        console.log(`[+] Impersonating GCP Service Account: ${targetAccount}`);
        client = new Impersonated({
            sourceClient: initialClient,
            targetPrincipal: targetAccount,
            lifetime: 3600,
            delegates: [],
            targetScopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
    } else {
        client = initialClient;
    }

    // 3. Project ID Discovery
    // Precedence: Envvar > Impersonated target > ADC discovery
    projectId = process.env.GOOGLE_CLOUD_PROJECT || await auth.getProjectId();

    google.options({ auth: client });
};

async function enableServices(services) {
    const serviceusage = google.serviceusage('v1');
    const parent = `projects/${projectId}`;

    // console.log(`[+] Checking/Enabling APIs for: ${projectId}`);

    const enablementPromises = services.map(async (serviceName) => {
        const resourceName = `${parent}/services/${serviceName}`;

        // console.log(resourceName);

        try {
            // 1. Check current state (Get)
            const { data: service } = await serviceusage.services.get({ name: resourceName });

            if (service.state === 'ENABLED') {
                // console.log(` ✅ Already Active: ${serviceName}`);
                return;
            }

            // 2. If not enabled, trigger enablement (Enable)
            console.log(`[*] Activating ${serviceName}...`);
            const { data: operation } = await serviceusage.services.enable({ name: resourceName });

            // 3. Poll the Operation (LRO) until done
            let opName = operation.name;
            let isDone = false;

            while (!isDone) {
                // Wait 2 seconds between polls
                await new Promise(resolve => setTimeout(resolve, 2000));

                const { data: currentOp } = await serviceusage.operations.get({ name: opName });

                if (currentOp.done) {
                    if (currentOp.error) {
                        throw new Error(`Failed to enable ${serviceName}: ${currentOp.error.message}`);
                    }
                    isDone = true;
                    console.log(`[+] Enabled ${serviceName}`);
                }
            }
        } catch (err) {
            console.error(`[!] Error with ${serviceName}: ${err.message}`);
            throw err;
        }
    });

    await Promise.all(enablementPromises);

    if (enablementPromises.filter(s => s !== null) > 0) {
        console.log(`[+] Services enabled. Waiting 15s for IAM/Quota propagation...`);
        await new Promise(resolve => setTimeout(resolve, 15000));
    } else {
        console.log(`[*] Requested GCP services were already enabled`);
    }

    return true
}

async function getProjectMetadata() {

    await enableServices(["cloudbilling.googleapis.com"]);

    // Initialize API clients
    const resourcemanager = google.cloudresourcemanager('v3');
    const billing = google.cloudbilling('v1');

    try {
    // 1. Get the Project details to find the immediate parent
    const projectResponse = await resourcemanager.projects.get({
        name: `projects/${projectId}`
    });

    let projectData = projectResponse.data;
    let orgId = false;
    let currentParent = projectData.parent;

    // 2. Traverse the Hierarchy to find the Organization ID
    // A parent can be 'folders/123' or 'organizations/456'
    while (currentParent) {
        if (currentParent.startsWith('organizations/')) {
            orgId = currentParent.split('/')[1];
            break;
        } else if (currentParent.startsWith('folders/')) {
            // If parent is a folder, look up that folder to see its parent
            const folderResponse = await resourcemanager.folders.get({
                name: currentParent
            });
            currentParent = folderResponse.data.parent;
        } else {
            // No organization found (e.g., project lives outside an Org)
            break;
        }
    }

    // 3. Get Billing Account Info
    const billingResponse = await billing.projects.getBillingInfo({
        name: `projects/${projectId}`
    });

    return {
        projectId: projectId,
        organizationId: orgId,
        // billingAccountName is usually in the format "billingAccounts/0X0X0X-0X0X0X-0X0X0X"
        billingAccount: billingResponse.data?.billingAccountName?.split('/')?.[1] || false,
        // In GCP, the 'Quota Project' is technically the project context 
        // used for the API call, which in this case is the project itself.
        quotaProject: projectId
    };

    } catch (error) {
        console.error(`[!] Error fetching metadata for project ${projectId}:`, error.message);
        throw error;
    }
}

exports.api = [async (fullPath, paramsJson) => {
    const parts = fullPath.split('.');
    if (parts.length < 2) {
        throw new Error(`Invalid GCP path: ${fullPath}. Expected format: service.version.path`);
    }

    const [serviceName, version, ...remainingPath] = parts;
    const params = JSON.parse(paramsJson);

    console.log(fullPath, params);

    // Initialize the specific API and version
    if (!google[serviceName]) {
        throw new Error(`GCP Service "${serviceName}" not found in googleapis library.`);
    }
    
    const api = google[serviceName]({ version, auth: this.client });

    // Traverse the remaining path
    let current = api;
    let parent = api;

    for (const segment of remainingPath) {
        parent = current;
        current = current[segment];
        
        if (current === undefined || current === null) {
            throw new Error(`Path segment "${segment}" not found in "${fullPath}"`);
        }
    }

    // Check if the resolved path is a function or a property
    if (typeof current === 'function') {
        // Call the function, ensuring 'this' is bound to the parent object
        const res = await current.call(parent, params);
        // Google API responses usually wrap data in a 'data' property
        return res.data || res;
    } else {
        // Return the property/object directly
        // return current;
        throw new Error(`"${fullPath}" is not a function.`);
    }
}, "fullPath", "paramsJson"];

exports.getProjectId = [() => projectId];