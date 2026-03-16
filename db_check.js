const { Client } = require('pg');
require('dotenv').config();

async function main() {
    const client = new Client({
        connectionString: process.env.RENTPE_DATABASE_URL,
    });
    await client.connect();
    try {
        const res = await client.query('SELECT id, name, status FROM "Property"');
        console.log("PROPERTIES:");
        console.table(res.rows);
        
        const logs = await client.query('SELECT "actionType", "entityId", "description", "createdAt" FROM "AuditLog" WHERE "entityType" = \'PROPERTY\' ORDER BY "createdAt" DESC LIMIT 5');
        console.log("\nRECENT AUDIT LOGS:");
        console.table(logs.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
