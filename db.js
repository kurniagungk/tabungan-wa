const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://uixgnumnpjhdpa:c1dd0d6f72184c8a74124d551783f6028118299a5b2e6d91de49e99c41813514@ec2-34-233-187-36.compute-1.amazonaws.com:5432/dfm37n3sdb1j85',
    ssl: {
        rejectUnauthorized: false
    }
});

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