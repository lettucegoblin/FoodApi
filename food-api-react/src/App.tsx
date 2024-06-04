import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import 'tailwindcss/tailwind.css';

let apiUrl = `http://127.0.0.1:6262/foodapi/brand/search`;
if (process.env.NODE_ENV === 'production') {
  apiUrl = `/foodapi/brand/search`;
}

let nutrientApiUrl = `http://127.0.0.1:6262/foodapi/brand/foodNutrients`;
if (process.env.NODE_ENV === 'production') {
  nutrientApiUrl = `/foodapi/brand/foodNutrients`;
}

const PAGE_SIZE = 10; // Number of items to fetch per page

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

const App: React.FC = () => {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<{ [key: number]: boolean }>({});
  const [nutrients, setNutrients] = useState<{ [key: number]: Nutrient[] }>({});
  const [servingSizes, setServingSizes] = useState<{ [key: number]: number }>({});
  const [allExpanded, setAllExpanded] = useState(false);
  const loader = useRef(null);

  const handleSearch = async () => {
    try {
      const response = await axios.get<ApiResponse>(`${apiUrl}`, {
        params: {
          term,
          page,
          pageSize: PAGE_SIZE,
        },
      });
      const newResults = response.data.data;
      const newServingSizes = newResults.reduce((acc, item) => {
        acc[item.id] = item.servingSize;
        return acc;
      }, {} as { [key: number]: number });
      setResults((prevResults) => [...prevResults, ...newResults]);
      setServingSizes((prevSizes) => ({ ...prevSizes, ...newServingSizes }));
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const loadMore = () => {
    setPage((prevPage) => prevPage + 1); // Increase page number
  };

  const fetchNutrients = async (brandedFoodId: number) => {
    try {
      const response = await axios.get<NutrientApiResponse>(nutrientApiUrl, {
        params: {
          brandedFoodId,
        },
      });
      setNutrients((prevNutrients) => ({
        ...prevNutrients,
        [brandedFoodId]: response.data.data,
      }));
    } catch (error) {
      console.error('Error fetching nutrient data:', error);
    }
  };

  useEffect(() => {
    if (term) {
      handleSearch();
    }
  }, [term, page]); // Run effect when term or page changes

  useEffect(() => {
    const handleObserver = (entities: IntersectionObserverEntry[]) => {
      const target = entities[0];
      if (target.isIntersecting) {
        loadMore();
      }
    };

    const options = {
      root: null,
      rootMargin: '20px',
      threshold: 1.0,
    };

    const observer = new IntersectionObserver(handleObserver, options);

    if (loader.current) {
      observer.observe(loader.current);
    }

    return () => {
      if (loader.current) {
        observer.unobserve(loader.current);
      }
    };
  }, []);

  const toggleExpand = (id: number, brandedFoodId: number) => {
    if (!expanded[id]) {
      fetchNutrients(brandedFoodId);
    }
    setExpanded((prevExpanded) => ({
      ...prevExpanded,
      [id]: !prevExpanded[id],
    }));
  };

  const toggleExpandAll = () => {
    const newExpandedState = !allExpanded;
    const newExpanded: { [key: number]: boolean } = {};
    results.forEach((item) => {
      newExpanded[item.id] = newExpandedState;
      if (!nutrients[item.id] && newExpandedState) {
        fetchNutrients(item.id);
      }
    });
    setExpanded(newExpanded);
    setAllExpanded(newExpandedState);
  };

  const handleServingSizeChange = (id: number, newServingSize: number) => {
    setServingSizes((prevSizes) => ({
      ...prevSizes,
      [id]: newServingSize,
    }));
  };

  const getNutrientAmount = (brandedFoodId: number, nutrientName: string) => {
    const nutrient = nutrients[brandedFoodId]?.find((n) => n.name === nutrientName);
    if (nutrient) {
      const servingSize = servingSizes[brandedFoodId] || results.find(item => item.id === brandedFoodId)?.servingSize;
      if (servingSize) {
        const servingSizeFactor = servingSize / results.find(item => item.id === brandedFoodId)?.servingSize!;
        return (nutrient.amount * servingSizeFactor).toFixed(2);
      }
    }
    return '0';
  };

  return (
    <div className="App p-4">
      <h1 className="text-2xl font-bold mb-4">Food Search</h1>
      <input
        type="text"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setPage(1);
          setResults([]);
        }}
        placeholder="Search for food..."
        className="border p-2 mb-4 w-full"
      />
      <button onClick={toggleExpandAll} className="bg-blue-500 text-white p-2 mb-4">
        {allExpanded ? 'Collapse All' : 'Expand All'}
      </button>
      <div>
        {results.map((item) => (
          <div key={item.id} className="mb-4 p-4 border rounded shadow-sm">
            <div
              className="cursor-pointer"
              onClick={() => toggleExpand(item.id, item.id)}
            >
              <h2 className="text-lg font-bold">{item.description}</h2>
            </div>
            {expanded[item.id] && (
              <div className="mt-2">
                <label className="block mb-2">
                  Serving Size:
                  <div>
                  <input
                    type="number"
                    value={servingSizes[item.id] || item.servingSize}
                    onChange={(e) => handleServingSizeChange(item.id, parseFloat(e.target.value))}
                    className="border p-2 ml-2 pr-5 text-right w-16"
                  />
                  <span className="-ml-4 pointer-events-none">
                    {item.servingSizeUnit}
                  </span>
                  </div>
                </label>
                <p><strong>Calories:</strong> {getNutrientAmount(item.id, "Energy")} kcal</p>
                <p><strong>Protein:</strong> {getNutrientAmount(item.id, "Protein")} g</p>
                <p><strong>Carbs:</strong> {getNutrientAmount(item.id, "Carbohydrate, by difference")} g</p>
                <p><strong>Total Fiber:</strong> {getNutrientAmount(item.id, "Fiber, total dietary")} g</p>
                <p><strong>Fat:</strong> {getNutrientAmount(item.id, "Total lipid (fat)")} g</p>
                <p><strong>Sugar:</strong> {getNutrientAmount(item.id, "Total Sugars")} g</p>
                <details className="mt-2">
                  <summary className="cursor-pointer">Ingredients</summary>
                  <p>{item.ingredients}</p>
                </details>
                <details className="mt-2">
                  <summary className="cursor-pointer">All Nutrients</summary>
                  <ul>
                    {nutrients[item.id]?.map((nutrient) => (
                      <li key={nutrient.id}>
                        <strong>{nutrient.name}:</strong> {(nutrient.amount * (servingSizes[item.id] || item.servingSize) / item.servingSize).toFixed(2)} {nutrient.unitName}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </div>
        ))}
      </div>
      <div ref={loader} />
    </div>
  );
};

export default App;
