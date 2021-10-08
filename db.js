const { Client } = require('pg');

let client


if (process.env.DATABASE_URL) {
    client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432',
        ssl: {
            rejectUnauthorized: false
        }
    });
} else {

    client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'tabungan_wa',
        port: 5432,
    })

}


client.connect();

const readsession = async () => {
    try {
        const res = await client.query('SELECT * FROM tabungan_wa');
        if (res.rows.length) return res.rows[0].data
        return ''
    } catch (err) {
        throw err
    }
}

const updateSesion = (data) => {

    client.query(
        'UPDATE "tabungan_wa" SET data = $1 WHERE "id" = $2',
        [data, 1],
        (error, results) => {
            if (error) {
                throw error
            }
            console.log('update')
        }
    )

}

module.exports = {
    readsession,
    updateSesion
}