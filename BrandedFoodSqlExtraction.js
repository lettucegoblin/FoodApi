const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');

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

        db.run(`CREATE TABLE IF NOT EXISTS FoodNutrients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            foundationalFoodId INTEGER,
            brandedFoodId INTEGER,
            nutrientId INTEGER,
            foodNutrientDerivationId INTEGER,
            max REAL,
            min REAL,
            median REAL,
            amount REAL,
            dataPoints INTEGER,
            FOREIGN KEY (brandedFoodId) REFERENCES BrandedFoods(id),
            FOREIGN KEY (foundationalFoodId) REFERENCES FoundationFoods(id),
            FOREIGN KEY (nutrientId) REFERENCES Nutrients(id),
            FOREIGN KEY (foodNutrientDerivationId) REFERENCES FoodNutrientDerivations(id)
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

        db.run(`CREATE TABLE IF NOT EXISTS FoundationFoods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fdcId INTEGER NOT NULL,
            foodClass TEXT,
            description TEXT,
            publicationDate TEXT,
            isHistoricalReference BOOLEAN
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS FoodPortions (
            id INTEGER PRIMARY KEY,
            foundationFoodId INTEGER,
            value REAL,
            measureUnitId INTEGER,
            modifier TEXT,
            gramWeight REAL,
            sequenceNumber INTEGER,
            minYearAcquired INTEGER,
            amount REAL,
            FOREIGN KEY (foundationFoodId) REFERENCES FoundationFoods(id),
            FOREIGN KEY (measureUnitId) REFERENCES MeasureUnits(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS MeasureUnits (
            id INTEGER PRIMARY KEY,
            name TEXT,
            abbreviation TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS FoodCategories (
            id INTEGER PRIMARY KEY,
            code TEXT,
            description TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS InputFoods (
            id INTEGER PRIMARY KEY,
            foundationFoodId INTEGER,
            foodDescription TEXT,
            inputFoodFdcId INTEGER,
            inputFoodDescription TEXT,
            inputFoodPublicationDate TEXT,
            inputFoodCategoryId INTEGER,
            FOREIGN KEY (foundationFoodId) REFERENCES FoundationFoods(id),
            FOREIGN KEY (inputFoodCategoryId) REFERENCES FoodCategories(id)
        )`);

        // Create indexes for faster search with joins and where clauses
        db.run("CREATE INDEX IF NOT EXISTS idx_foodnutrients_nutrientid ON FoodNutrients(nutrientId);");
        db.run("CREATE INDEX IF NOT EXISTS idx_nutrients_id ON Nutrients(id);");
        db.run("CREATE INDEX IF NOT EXISTS idx_foodnutrients_brandedfoodid ON FoodNutrients(brandedFoodId);");
    });
};

// Insert data into tables
const insertData = (data, type) => {
    if (type === 'Branded') {
        const food = data.value;
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
    } else if (type === 'Foundation') {
        const food = data;
        db.run(`INSERT INTO FoundationFoods (fdcId, foodClass, description, publicationDate, isHistoricalReference)
            VALUES (?, ?, ?, ?, ?)`,
            [food.fdcId, food.foodClass, food.description, food.publicationDate, food.isHistoricalReference],
            function (err) {
                if (err) {
                    return console.log(err.message);
                }
                const foundationFoodId = this.lastID;

                // Insert food nutrients
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
                            db.run(`INSERT INTO FoodNutrients (foundationalFoodId, nutrientId, foodNutrientDerivationId, amount, max, min, median, dataPoints) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                                [foundationFoodId, nutrient.nutrient.id, derivationId, nutrient.amount, nutrient.max, nutrient.min, nutrient.median, nutrient.dataPoints], function (err) {
                                if (err) {
                                    return console.log(err.message);
                                }
                            });
                           
                        });
                });

                // Insert food portions
                if(food && food.foodPortions)
                food.foodPortions.forEach(portion => {
                    db.run(`INSERT INTO MeasureUnits (id, name, abbreviation) VALUES (?, ?, ?)
                        ON CONFLICT(id) DO NOTHING`,
                        [portion.measureUnit.id, portion.measureUnit.name, portion.measureUnit.abbreviation], function (err) {
                            if (err) {
                                return console.log(err.message);
                            }
                        });

                    db.run(`INSERT INTO FoodPortions (id, foundationFoodId, value, measureUnitId, modifier, gramWeight, sequenceNumber, minYearAcquired, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [portion.id, foundationFoodId, portion.value, portion.measureUnit.id, portion.modifier, portion.gramWeight, portion.sequenceNumber, portion.minYearAcquired, portion.amount], function (err) {
                            if (err) {
                                return console.log(err.message);
                            }
                        });
                });

                // Insert input foods
                if(food && food.inputFoods)
                food.inputFoods.forEach(input => {
                    db.run(`INSERT INTO FoodCategories (id, code, description) VALUES (?, ?, ?)
                        ON CONFLICT(id) DO NOTHING`,
                        [input.inputFood.foodCategory.id, input.inputFood.foodCategory.code, input.inputFood.foodCategory.description], function (err) {
                            if (err) {
                                return console.log(err.message);
                            }
                        });

                    db.run(`INSERT INTO InputFoods (id, foundationFoodId, foodDescription, inputFoodFdcId, inputFoodDescription, inputFoodPublicationDate, inputFoodCategoryId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [input.id, foundationFoodId, input.foodDescription, input.inputFood.fdcId, input.inputFood.description, input.inputFood.publicationDate, input.inputFood.foodCategory.id], function (err) {
                            if (err) {
                                return console.log(err.message);
                            }
                        });
                });
            });
    }
};

// Execute the script
createTables();

let dataSaved = 0;

// const brandedPipeline = chain([
//     fs.createReadStream('brandedDownload.json'),
//     parser(),
//     streamArray()
// ]);

// brandedPipeline.on('data', (data) => {
//     insertData(data, 'Branded');

//     dataSaved++;
//     if (dataSaved % 20 === 0) {
//         console.log('Branded data saved:', dataSaved, data.value.description);
//     }
// });

const foundationPipeline = chain([
    fs.createReadStream('foundationDownload.json'),
    parser(),
    streamArray()
]);

foundationPipeline.on('data', (data) => {
    insertData(data.value, 'Foundation');

    dataSaved++;
    if (dataSaved % 20 === 0) {
        console.log('Foundation data saved:', dataSaved, data.value.description);
    }
});

foundationPipeline.on('end', () => {
    console.log('All foundation data inserted.');
    db.close();
});

foundationPipeline.on('error', (err) => {
    console.error('Error:', err);
});

// brandedPipeline.on('end', () => {
//     console.log('All branded data inserted.');
//     foundationPipeline.resume(); // Start the foundation pipeline
// });

// brandedPipeline.on('error', (err) => {
//     console.error('Error:', err);
// });

// Start by running the branded pipeline
//brandedPipeline.resume();
