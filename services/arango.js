const orango = require('orango');

const { EVENTS } = orango.consts;
const db = orango.get("nextsys");

// we are connected, but orango has not initialized the models
db.events.once(EVENTS.CONNECTED, conn => {
    console.log('🥑  Connected to ArangoDB:', conn.url + '/' + conn.name)
})

// everything is initialized and we are ready to go
db.events.once(EVENTS.READY, () => {
    console.log('🍊  Orango is ready!')
})

async function main() {
    try {
        await db.connect(
            {
                url: process.env.DB_HOST,
                username: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD
                // url: "http://localhost:8529",
                // username: "root",
                // password: "root",
            }
        );
        // everything is initialized and we are ready to go
        console.log('Are we connected?', db.connection.connected) // true
        //db.createCollection("actors")

    } catch (e) {
        console.log('Error:', e.message)
    }
}

main()

module.exports = {
    db,
}