const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const port = 6262;

const db = new sqlite3.Database('brandedFoods.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the brandedFoods database.');
    }
});
app.use(cors());

// Extended: https://swagger.io/specification/#infoObject
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Food API',
            description: 'Food API Information',
            contact: {
                name: 'Developer'
            },
            servers: [{ url: `http://localhost:${port}` }]
        }
    },
    apis: ['index.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /foodapi/brandSearch:
 *   get:
 *     summary: Searches branded foods.
 *     parameters:
 *       - name: term
 *         in: query
 *         description: Search term for branded foods
 *         required: true
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         description: Page number
 *         schema:
 *           type: integer
 *       - name: pageSize
 *         in: query
 *         description: Number of items per page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: A list of branded foods
 *       400:
 *         description: Bad request
 */
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
});

/**
 * @swagger
 * /foodapi/foundationSearch:
 *   get:
 *     summary: Searches foundation foods.
 *     parameters:
 *       - name: term
 *         in: query
 *         description: Search term for foundation foods
 *         required: true
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         description: Page number
 *         schema:
 *           type: integer
 *       - name: pageSize
 *         in: query
 *         description: Number of items per page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: A list of foundation foods
 *       400:
 *         description: Bad request
 */
app.get('/foodapi/foundationSearch', (req, res) => {
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
});

/**
 * @swagger
 * /foodapi/searchAll:
 *   get:
 *     summary: Searches all foods.
 *     parameters:
 *       - name: term
 *         in: query
 *         description: Search term for all foods
 *         required: true
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         description: Page number
 *         schema:
 *           type: integer
 *       - name: pageSize
 *         in: query
 *         description: Number of items per page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: A list of all foods
 *       400:
 *         description: Bad request
 */
app.get('/foodapi/searchAll', (req, res) => {
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
});

/**
 * @swagger
 * /foodapi/foodNutrients:
 *   get:
 *     summary: Retrieves nutrients of a food.
 *     parameters:
 *       - name: brandedFoodId
 *         in: query
 *         description: Branded food ID
 *         schema:
 *           type: string
 *       - name: foundationalFoodId
 *         in: query
 *         description: Foundational food ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Nutrients of the food
 *       400:
 *         description: Bad request
 */
app.get('/foodapi/foodNutrients', async (req, res) => {
    const brandedFoodId = req.query.brandedFoodId;
    const foundationalFoodId = req.query.foundationalFoodId;
    try {
        const result = await getFoodNutrients(brandedFoodId, foundationalFoodId);
        res.json(result);
    } catch (error) {
        res.status(400).json(error);
    }
});

app.get('/foodapi/', (req, res) => {
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
            SELECT FoundationFoods.*, 100.0 as servingSize, 'g' as servingSizeUnit
            FROM FoundationFoods
            WHERE FoundationFoods.description LIKE  ?
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
            SELECT id, fdcId, description, servingSize, 
            servingSizeUnit, 'Branded' AS foodClass,
            ingredients
            FROM BrandedFoods
            WHERE description LIKE ?
        ),
        FoundationFoodsFiltered AS (
            SELECT id, fdcId, description, 
            100.0 as servingSize, 'g' as servingSizeUnit, 'Foundation' AS foodClass,
            '' as ingredients
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
