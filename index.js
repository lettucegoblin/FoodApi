const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const cors = require('cors');

const port = 6262;

const db = new sqlite3.Database('brandedFoods.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the brandedFoods database.');
    }
});
app.use(cors());
// example: http://127.0.0.1:3000/foodapi/search?term=soup&page=1&pageSize=10
app.get('/foodapi/brandSearch', (req, res) => {
    const searchTerm = req.query.term;
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 10;
    const offset = (page - 1) * pageSize;

    searchBrandedFoods(searchTerm, pageSize, offset)
        .then(result => {
            res.json(result);
        })
        .catch(error => {
            res.status(400).json(error);
        });
})
.get('/foodapi/foundationSearch', (req, res) => {
    const searchTerm = req.query.term;
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 10;
    const offset = (page - 1) * pageSize;

    searchFoundationFoods(searchTerm, pageSize, offset)
        .then(result => {
            res.json(result);
        })
        .catch(error => {
            res.status(400).json(error);
        });
})
.get('/foodapi/searchAll', (req, res) => {
    const searchTerm = req.query.term;
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 10;
    const offset = (page - 1) * pageSize;

    searchAllFoods(searchTerm, pageSize, offset)
        .then(result => {
            res.json(result);
        })
        .catch(error => {
            res.status(400).json(error);
        });
})
.get('/foodapi/foodNutrients', async (req, res) => {
    const brandedFoodId = req.query.brandedFoodId;
    const foundationalFoodId = req.query.foundationalFoodId;
    try {
        const result = await getFoodNutrients(brandedFoodId, foundationalFoodId);
        res.json(result);
    } catch (error) {
        res.status(400).json(error);
    }
})
.get('/foodapi/', (req, res) => {
    res.sendFile('food-api-react/build/index.html', {root: __dirname});
})
.use('/foodapi', express.static('food-api-react/build'))
.listen(port, () => {
    console.log(`Server running on port ${port}`);
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
        LIMIT ? OFFSET ?`;
        
        db.all(sql, [`%${searchTerm}%`, pageSize, offset], (err, rows) => {
            if (err) {
                reject({"error": err.message});
            } else {
                resolve({
                    "message": "success",
                    "data": rows
                });
            }
        });
    });
}

function searchFoundationFoods(searchTerm, pageSize, offset) {
    return new Promise((resolve, reject) => {
        const sql = `WITH FilteredFoods AS (
            SELECT *
            FROM FoundationFoods
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
        LIMIT ? OFFSET ?`;
        
        db.all(sql, [`%${searchTerm}%`, pageSize, offset], (err, rows) => {
            if (err) {
                reject({"error": err.message});
            } else {
                resolve({
                    "message": "success",
                    "data": rows
                });
            }
        });
    });
}

function searchAllFoods(searchTerm, pageSize, offset) {
    return new Promise((resolve, reject) => {
        const sql = `WITH BrandedFoodsFiltered AS (
            SELECT id, fdcId, description, 'Branded' AS foodClass
            FROM BrandedFoods
            WHERE description LIKE ?
        ),
        FoundationFoodsFiltered AS (
            SELECT id, fdcId, description, 'Foundation' AS foodClass
            FROM FoundationFoods
            WHERE description LIKE ?
        ),
        AllFoods AS (
            SELECT *
            FROM BrandedFoodsFiltered
            UNION ALL
            SELECT *
            FROM FoundationFoodsFiltered
        ),
        RankedFoods AS (
            SELECT *,
                ROW_NUMBER() OVER (PARTITION BY fdcId ORDER BY id DESC) AS rn
            FROM AllFoods
        )
        SELECT *
        FROM RankedFoods
        WHERE rn = 1
        LIMIT ? OFFSET ?`;

        db.all(sql, [`%${searchTerm}%`, `%${searchTerm}%`, pageSize, offset], (err, rows) => {
            if (err) {
                reject({"error": err.message});
            } else {
                resolve({
                    "message": "success",
                    "data": rows
                });
            }
        });
    });
}

function getFoodNutrients(brandedFoodId, foundationalFoodId) {
    return new Promise((resolve, reject) => {
        let sql = '';
        let params = [];
        if (brandedFoodId) {
            sql = `SELECT * FROM FoodNutrients 
                   JOIN Nutrients ON FoodNutrients.nutrientId = Nutrients.id 
                   WHERE FoodNutrients.brandedFoodId = ?`;
            params = [brandedFoodId];
        } else if (foundationalFoodId) {
            sql = `SELECT * FROM FoodNutrients 
                   JOIN Nutrients ON FoodNutrients.nutrientId = Nutrients.id 
                   WHERE FoodNutrients.foundationalFoodId = ?`;
            params = [foundationalFoodId];
        } else {
            reject({"error": "No valid food ID provided"});
            return;
        }
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject({"error": err.message});
            } else {
                resolve({
                    "message": "success",
                    "data": rows
                });
            }
        });
    });
}
