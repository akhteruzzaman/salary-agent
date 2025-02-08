const mysql = require('mysql2');
const readline = require('readline');
const OpenAI = require('openai');
require('dotenv').config();

// Setup OpenAI API
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Setup MySQL Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Change if needed
    password: '', // Change if needed
    database: 'employee_db'
});

db.connect(err => {
    if (err) {
        console.error('Database connection error:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL database.');
});

// Setup Terminal Input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to extract SQL query from AI response
function extractSQL(response) {
    const match = response.match(/SELECT .*?;/is); // Extracts only the SQL query
    return match ? match[0] : null; // Returns the query or null if no match
}

async function askAI(query) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are an AI that generates SQL queries for a MySQL database named 'employee_db'. Always use the 'employee' table. Columns: 'id', 'role', 'salary'." },
                { role: "user", content: `Generate a SQL query: ${query}` }
            ],
        });

        let sqlQuery = extractSQL(response.choices[0].message.content.trim());

        if (!sqlQuery) {
            console.error('Failed to extract SQL query.');
            return null;
        }

        return sqlQuery;
    } catch (error) {
        console.error('Error from OpenAI:', error);
        return null;
    }
}

async function fetchFromDatabase(sql) {
    return new Promise((resolve, reject) => {
        db.query(sql, (error, results) => {
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
}

async function main() {
    rl.question('Enter your query: ', async (userInput) => {
        const sqlQuery = await askAI(userInput);
        if (!sqlQuery) {
            console.log('No valid SQL query generated.');
            rl.close();
            db.end();
            return;
        }

        console.log('Generated SQL Query:', sqlQuery);

        try {
            const data = await fetchFromDatabase(sqlQuery);
            console.log('Database Results:', data);
        } catch (error) {
            console.error('Database Error:', error);
        }

        rl.close();
        db.end();
    });
}

main();
