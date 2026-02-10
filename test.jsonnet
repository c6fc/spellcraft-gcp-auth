/*
	This file should manifest all the exposed features of your module
	so users can see examples of how they are used, and the output they
	generate.
*/

local gcp = import "module.libsonnet";

{
	// gcp.api() sends the current project by default.
	// Provide an empty param object to override this behavior.
	api: gcp.api("cloudresourcemanager.v1.projects.list", {}),

	getProjectId: gcp.getProjectId(),
	listBuckets: gcp.listBuckets(),

	// Providing any param overrides the default, which means we need to
	// add 'project' back in manually when providing the required 'zone' here.
	listInstances: gcp.listInstances({ project: gcp.getProjectId(), zone: "us-west1-b" })
}