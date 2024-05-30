const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');


// Read the JSON file
const jsonData = [];
const readStream = fs.createReadStream('brandedDownload.json', 'utf8');

readStream.on('data', (chunk) => {
    jsonData.push(chunk);
});

readStream.on('end', () => {
    const parsedData = JSON.parse(jsonData.join(''));
    
    // // Execute the script
    // createTables();
    // insertData();
    // db.close();

});

readStream.on('error', (err) => {
    console.log(err);
});

// Connect to SQLite database
const db = new sqlite3.Database('brandedFoods.db');

// Create tables
const createTables = () => {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS BrandedFoods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fdcId INTEGER NOT NULL,
            foodClass TEXT,
            description TEXT,
            modifiedDate TEXT,
            availableDate TEXT,
            marketCountry TEXT,
            brandOwner TEXT,
            gtinUpc TEXT,
            dataSource TEXT,
            ingredients TEXT,
            servingSize REAL,
            servingSizeUnit TEXT,
            householdServingFullText TEXT,
            brandedFoodCategory TEXT,
            dataType TEXT,
            publicationDate TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS Nutrients (
            id INTEGER PRIMARY KEY,
            number TEXT,
            name TEXT,
            rank INTEGER,
            unitName TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS FoodNutrientSources (
            id INTEGER PRIMARY KEY,
            code TEXT,
            description TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS FoodNutrientDerivations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT,
            description TEXT,
            foodNutrientSourceId INTEGER,
            FOREIGN KEY (foodNutrientSourceId) REFERENCES FoodNutrientSources(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS FoodNutrients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brandedFoodId INTEGER,
            nutrientId INTEGER,
            foodNutrientDerivationId INTEGER,
            amount REAL,
            FOREIGN KEY (brandedFoodId) REFERENCES BrandedFoods(id),
            FOREIGN KEY (nutrientId) REFERENCES Nutrients(id),
            FOREIGN KEY (foodNutrientDerivationId) REFERENCES FoodNutrientDerivations(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS FoodAttributeTypes (
            id INTEGER PRIMARY KEY,
            name TEXT,
            description TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS FoodAttributes (
            id INTEGER PRIMARY KEY,
            brandedFoodId INTEGER,
            name TEXT,
            value TEXT,
            foodAttributeTypeId INTEGER,
            FOREIGN KEY (brandedFoodId) REFERENCES BrandedFoods(id),
            FOREIGN KEY (foodAttributeTypeId) REFERENCES FoodAttributeTypes(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS LabelNutrients (
            brandedFoodId INTEGER,
            nutrientName TEXT,
            value REAL,
            PRIMARY KEY (brandedFoodId, nutrientName),
            FOREIGN KEY (brandedFoodId) REFERENCES BrandedFoods(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS FoodUpdateLogs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brandedFoodId INTEGER,
            foodClass TEXT,
            description TEXT,
            dataType TEXT,
            fdcId INTEGER,
            publicationDate TEXT,
            FOREIGN KEY (brandedFoodId) REFERENCES BrandedFoods(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS FoodUpdateLogAttributes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            foodUpdateLogId INTEGER,
            attributeId INTEGER,
            FOREIGN KEY (foodUpdateLogId) REFERENCES FoodUpdateLogs(id),
            FOREIGN KEY (attributeId) REFERENCES FoodAttributes(id)
        )`);
    });
};

// Insert data into tables
const insertData = () => {
    const brandedFoods = jsonData.BrandedFoods;

    brandedFoods.forEach(food => {
        db.run(`INSERT INTO BrandedFoods (fdcId, foodClass, description, modifiedDate, availableDate, marketCountry, brandOwner, gtinUpc, dataSource, ingredients, servingSize, servingSizeUnit, householdServingFullText, brandedFoodCategory, dataType, publicationDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [food.fdcId, food.foodClass, food.description, food.modifiedDate, food.availableDate, food.marketCountry, food.brandOwner, food.gtinUpc, food.dataSource, food.ingredients, food.servingSize, food.servingSizeUnit, food.householdServingFullText, food.brandedFoodCategory, food.dataType, food.publicationDate],
            function (err) {
                if (err) {
                    return console.log(err.message);
                }
                const brandedFoodId = this.lastID;

                // Insert food attributes
                food.foodAttributes.forEach(attr => {
                    db.run(`INSERT INTO FoodAttributes (brandedFoodId, name, value, foodAttributeTypeId) VALUES (?, ?, ?, ?)`,
                        [brandedFoodId, attr.name, attr.value, attr.foodAttributeType.id], function (err) {
                            if (err) {
                                return console.log(err.message);
                            }
                        });
                });

                // Insert label nutrients
                const labelNutrients = food.labelNutrients;
                for (const key in labelNutrients) {
                    if (labelNutrients.hasOwnProperty(key)) {
                        db.run(`INSERT INTO LabelNutrients (brandedFoodId, nutrientName, value) VALUES (?, ?, ?)`,
                            [brandedFoodId, key, labelNutrients[key].value], function (err) {
                                if (err) {
                                    return console.log(err.message);
                                }
                            });
                    }
                }

                // Insert food nutrients and related tables
                food.foodNutrients.forEach(nutrient => {
                    db.run(`INSERT INTO Nutrients (id, number, name, rank, unitName) VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO NOTHING`,
                        [nutrient.nutrient.id, nutrient.nutrient.number, nutrient.nutrient.name, nutrient.nutrient.rank, nutrient.nutrient.unitName], function (err) {
                            if (err) {
                                return console.log(err.message);
                            }
                        });

                    db.run(`INSERT INTO FoodNutrientSources (id, code, description) VALUES (?, ?, ?)
                        ON CONFLICT(id) DO NOTHING`,
                        [nutrient.foodNutrientDerivation.foodNutrientSource.id, nutrient.foodNutrientDerivation.foodNutrientSource.code, nutrient.foodNutrientDerivation.foodNutrientSource.description], function (err) {
                            if (err) {
                                return console.log(err.message);
                            }
                        });

                    db.run(`INSERT INTO FoodNutrientDerivations (code, description, foodNutrientSourceId) VALUES (?, ?, ?)`,
                        [nutrient.foodNutrientDerivation.code, nutrient.foodNutrientDerivation.description, nutrient.foodNutrientDerivation.foodNutrientSource.id], function (err) {
                            if (err) {
                                return console.log(err.message);
                            }
                            const derivationId = this.lastID;

                            db.run(`INSERT INTO FoodNutrients (brandedFoodId, nutrientId, foodNutrientDerivationId, amount) VALUES (?, ?, ?, ?)`,
                                [brandedFoodId, nutrient.nutrient.id, derivationId, nutrient.amount], function (err) {
                                    if (err) {
                                        return console.log(err.message);
                                    }
                                });
                        });
                });

                // Insert food update logs
                food.foodUpdateLog.forEach(log => {
                    db.run(`INSERT INTO FoodUpdateLogs (brandedFoodId, foodClass, description, dataType, fdcId, publicationDate) VALUES (?, ?, ?, ?, ?, ?)`,
                        [brandedFoodId, log.foodClass, log.description, log.dataType, log.fdcId, log.publicationDate], function (err) {
                            if (err) {
                                return console.log(err.message);
                            }
                            const logId = this.lastID;

                            // Insert food update log attributes
                            log.foodAttributes.forEach(attr => {
                                db.run(`INSERT INTO FoodUpdateLogAttributes (foodUpdateLogId, attributeId) VALUES (?, ?)`,
                                    [logId, attr.id], function (err) {
                                        if (err) {
                                            return console.log(err.message);
                                        }
                                    });
                            });
                        });
                });
            });
    });
};
