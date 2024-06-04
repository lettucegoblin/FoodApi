const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const cors = require('cors'); 

const port = 6262;
app.use(cors())

app.use(express.static('food-api-react/build'));

const db = new sqlite3.Database('brandedFoods.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the brandedFoods database.');
    }
});

// example: http://127.0.0.1:3000/foodapi/search?term=soup&page=1&pageSize=10
app.get('/foodapi/brand/search', (req, res) => {
    const searchTerm = req.query.term;
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 10;
    const offset = (page - 1) * pageSize;
    //const sql = `SELECT * FROM BrandedFoods WHERE description LIKE ? ORDER BY id LIMIT ? OFFSET ?`;

    searchBrandedFoods(searchTerm, pageSize, offset)
        .then(result => {
            res.json(result);
        })
        .catch(error => {
            res.status(400).json(error);
        });

    
});

// example: http://127.0.0.1:3000/api/foodNutrients?brandedFoodId=12345
app.get('/foodapi/brand/foodNutrients', async (req, res) => {
    const brandedFoodId = req.query.brandedFoodId;
    try {
        const result = await getFoodNutrients(brandedFoodId);
        res.json(result);
    } catch (error) {
        res.status(400).json(error);
    }
});

function searchBrandedFoods(searchTerm, pageSize, offset) {
    return new Promise((resolve, reject) => {
        const sql = `WITH FilteredFoods AS (
            SELECT *
            FROM BrandedFoods
            WHERE description LIKE ?
        ),
        RankedFoods AS (
            SELECT *,
                ROW_NUMBER() OVER (PARTITION BY fdcId ORDER BY id DESC) AS rn
            FROM FilteredFoods
        )
        SELECT *
        FROM RankedFoods
        WHERE rn = 1
        LIMIT ? OFFSET ?
        `
        db.all(sql, [`%${searchTerm}%`, pageSize, offset], (err, rows) => {
            if (err) {
                reject({"error": err.message});
            } else {
                resolve({
                    "message":"success",
                    "data":rows
                });
            }
        });
    });
}

function getFoodNutrients(brandedFoodId) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM FoodNutrients 
                     JOIN Nutrients ON FoodNutrients.nutrientId = Nutrients.id 
                     WHERE FoodNutrients.brandedFoodId = ?`; 
        db.all(sql, [brandedFoodId], (err, rows) => {
            if (err) {
                reject({"error": err.message});
            } else {
                resolve({
                    "message":"success",
                    "data":rows
                });
            }
        });
    });
}


app.get('/foodapi/brand/searchAll', (req, res) => {
    const searchTerm = req.query.term;
    const sql = `SELECT * FROM BrandedFoods WHERE description LIKE ?`;
    db.all(sql, [`%${searchTerm}%`], (err, rows) => {
        if (err) {
            res.status(400).json({"error": err.message});
            return;
        }
        res.json({
            "message":"success",
            "data":rows
        });
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});