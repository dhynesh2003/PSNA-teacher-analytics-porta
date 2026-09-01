import { getOrganizations } from "../edmingle/client.js";

const result = await getOrganizations();
// Credentials are never printed; only the API response is shown for schema discovery.
console.log(JSON.stringify(result, null, 2));
