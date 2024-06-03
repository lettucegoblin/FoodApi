interface Nutrient {
    id: number;
    brandedFoodId: number;
    nutrientId: number;
    foodNutrientDerivationId: number;
    amount: number;
    number: string;
    name: string;
    rank: number;
    unitName: string;
}

interface NutrientApiResponse {
    message: string;
    data: Nutrient[];
}
interface FoodItem {
    id: number;
    fdcId: number;
    foodClass: string;
    description: string;
    modifiedDate: string;
    availableDate: string;
    marketCountry: string;
    brandOwner: string;
    gtinUpc: string;
    dataSource: string;
    ingredients: string;
    servingSize: number;
    servingSizeUnit: string;
    householdServingFullText: string;
    brandedFoodCategory: string;
    dataType: string;
    publicationDate: string;
}

interface ApiResponse {
    message: string;
    data: FoodItem[];
}


export type { Nutrient, NutrientApiResponse, FoodItem, ApiResponse };