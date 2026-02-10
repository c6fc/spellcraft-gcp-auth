// Don't try to 'import' your spellcraft native functions here.
// Use std.native(function)(..args) instead

{

  local gcp = self,

  /**
   * Returns the default Project ID from the environment
   */
  getProjectId():: std.native('@c6fc/spellcraft-gcp-auth:getProjectId')(),

  /**
   * Returns information about the default Project ID from the environment
   *
   * @returns
   {
      projectId: <projectId>,
      organizationId: <orgId || false>,
      billingAccount: <billingAccountName || false>,
      quotaProject: <projectId>
   }
   */
  getProjectMetadata():: std.native('@c6fc/spellcraft-gcp-auth:getProjectMetadata')(),

  /**
   * Returns details about the current authentication token
   */
  getCallerIdentity():: std.native('@c6fc/spellcraft-gcp-auth:getCallerIdentity')(),

  /**
   * Enables API services during manifestation so they're already available before
   * tools run. This is meant to sidestep the 'stage zero' bootstrapping problem.
   *
   * @param {array} services
   * @returns {object} backend
   * @example
   * local gcp = import "@c6fc/spellcraft-gcp-auth";
   *
   * gcp.enableServices([
   *    "cloudresourcemanager.googleapis.com",
   *    "cloudbilling.googleapis.com"
   * ]);
   *
   * // Returns:
   * true
   */
  enableServices(services):: std.native("@c6fc/spellcraft-gcp-auth:enableServices")(std.manifestJsonEx(services, "")),

  /**
   * Generic GCP API Call
   * 
   * @param {string} path - A dot-delimited path of <service>.<version>.<...method> (e.g. 'compute.v1.zones.list' or 'storage.v1.buckets.list')
   * @param {object} params - The request parameters
   */
  api(fullpath, params={ project: gcp.getProjectId() }):: 
      std.native('@c6fc/spellcraft-gcp-auth:api')(
          fullpath, 
          std.manifestJsonEx(params, '')
      ),

  /**
   * Shortcut for Cloud Storage Buckets list
   */
  listBuckets(params={ project: gcp.getProjectId() }):: 
      gcp.api('storage.v1.buckets.list', params),

  /**
   * Shortcut for Compute Instances list
   */
  listInstances(params={ project: gcp.getProjectId() }):: 
      gcp.api('compute.v1.instances.list', params),

  /**
   * Termination check to ensure we are in the right project
   */
  assertProject(expectedId)::
      assert gcp.getProjectId() == expectedId : "Expected project %s, but context is %s" % [expectedId, gcp.getProjectId()];
      expectedId,
}