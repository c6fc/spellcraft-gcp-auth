# SpellCraft @c6fc/spellcraft-gcp-auth Module

[![NPM version](https://img.shields.io/npm/v/@c6fc/spellcraft-gcp-auth.svg?style=flat)](https://www.npmjs.com/package/@c6fc/spellcraft-gcp-auth)
[![License](https://img.shields.io/npm/l/@c6fc/spellcraft-gcp-auth.svg?style=flat)](https://opensource.org/licenses/MIT)

Seamlessly integrate [Google APIs Node.js Client](https://www.npmjs.com/package/googleapis) into your [SpellCraft](https://github.com/@c6fc/spellcraft) SpellFrames. This plugin allows you to natively expose authenticated GCP contexts and identity impersonation to your SpellFrames, and use the full power of the APIs in both JavaScript native functions and JSonnet.

```sh
npm install --save @c6fc/spellcraft @c6fc/spellcraft-gcp-auth
```

This module will use credential sources in the same order as the API Library for JavaScript, with service account impersonation happening after the priority credential source is identified.

```sh
# Show your current gcloud credential context
npx spellcraft gcp-identity

{
	identity: 'you@yourorganization.example',
	projectId: 'purple-giggletron-121405',
	scopes: [
		'https://www.googleapis.com/auth/cloud-platform',
		'https://www.googleapis.com/auth/sqlservice.login',
		'https://www.googleapis.com/auth/userinfo.email',
		'openid'
	],
	expiresIn: 3599,
	authType: 'User/Authorized Account',
	impersonatedBy: null
}

```

You can perform service account impersonation using this initial context to chain into a different deployment role by setting the `SPELLFRAME_GCP_IMPERSONATE` envvar:

```sh
export SPELLFRAME_GCP_IMPERSONATE="terraform-deploy@purple-giggletron-121405.iam.gserviceaccount.com"

# See the new assumerole credential context:
npx spellcraft gcp-identity

[+] Impersonating GCP Service Account: terraform-deploy@purple-giggletron-121405.iam.gserviceaccount.com
{
	identity: 'terraform-deploy@purple-giggletron-121405.iam.gserviceaccount.com',
	projectId: 'purple-giggletron-121405',
	scopes: [ 'https://www.googleapis.com/auth/cloud-platform' ],
	expiresIn: 3599,
	authType: 'Impersonated Service Account',
	impersonatedBy: 'Local ADC/Key'
}
```

## Features

- Authenticate to GCP with native means, as well as role assumptions with `SPELLFRAME_GCP_IMPERSONATE`
- Provide an authenticated `google` instance to function contexts.
- Expose all `googleapis` clients and methods directly to JSonnet.

<!-- SPELLCRAFT_DOCS_CLI_START -->
## CLI Commands

- **`spellcraft gcp-identity`**
  Display the GCP identity of the SpellCraft execution context

<!-- SPELLCRAFT_DOCS_CLI_END -->

## SpellFrame 'init()' features

Extends the SpellFrame's `init()` to include obtaining GCP credentials, and optionally performing service account impersonation, before instantiating the [Google APIs Node.js Client](https://www.npmjs.com/package/googleapis).

## JavaScript context features

Exposes `this.google` for all native function executions, which is an authenticated [Google APIs Node.js Client](https://www.npmjs.com/package/googleapis)

<!-- SPELLCRAFT_DOCS_API_START -->
## API Reference

### `getProjectId()`

Returns the default Project ID from the environment

---
### `api(fullpath, params={ project: gcp.getProjectId()`

Generic GCP API Call

- param {string} path - A dot-delimited path of <service>.<version>.<...method> (e.g. 'compute.v1.zones.list' or 'storage.v1.buckets.list')
- param {object} params - The request parameters

---
### `listBuckets(params={ project: gcp.getProjectId()`

Shortcut for Cloud Storage

---
### `listInstances(params={ project: gcp.getProjectId()`

Shortcut for Compute Instances

---
### `assertProject(expectedId)`

Termination check to ensure we are in the right project

---

<!-- SPELLCRAFT_DOCS_API_END -->

## Installation

Install the plugin as a dependency in your SpellCraft project:

```bash
npm install --save @c6fc/spellcraft-gcp-auth
```

Then import the module into your Jsonnet code and use it.

```jsonnet
local gcp = import "@c6fc/spellcraft-gcp-auth/module.jsonnet";

{
	'identity.json': {
		gcp: gcp.getCallerIdentity()
	}
}
```