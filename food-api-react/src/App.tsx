import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import {
  Box,
  Button,
  Container,
  CssBaseline,
  InputAdornment,
  TextField,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Input,
  IconButton,
  Divider,
  CircularProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import 'tailwindcss/tailwind.css';

let apiUrl = `http://127.0.0.1:6262/foodapi/search`;
if (process.env.NODE_ENV === 'production') {
  apiUrl = `/foodapi/search`;
}

let nutrientApiUrl = `http://127.0.0.1:6262/foodapi/foodNutrients`;
if (process.env.NODE_ENV === 'production') {
  nutrientApiUrl = `/foodapi/foodNutrients`;
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
  const loader = useRef<HTMLDivElement | null>(null);

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

  // decrease by one
  const decreaseServingSize = (id: number) => {
    setServingSizes((prevSizes) => ({
      ...prevSizes,
      [id]: prevSizes[id] - 1,
    }));
  };

  // increase by one
  const increaseServingSize = (id: number) => {
    setServingSizes((prevSizes) => ({
      ...prevSizes,
      [id]: prevSizes[id] + 1,
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
    <Container>
      <CssBaseline />
      <Typography variant="h4" component="h1" gutterBottom>
        Food Search
      </Typography>
      <TextField
        label="Search for food..."
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setPage(1);
          setResults([]);
        }}
        fullWidth
        margin="normal"
        variant="outlined"
      />
      <Button
        variant="contained"
        color="primary"
        onClick={toggleExpandAll}
        style={{ marginBottom: '20px' }}
      >
        {allExpanded ? 'Collapse All' : 'Expand All'}
      </Button>
      <div>
        {results.map((item) => (
          <Accordion
            key={item.id}
            expanded={expanded[item.id]}
            onChange={() => toggleExpand(item.id, item.id)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">{item.description}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box mb={2}>
                <FormControl variant="outlined" fullWidth>
                  <InputLabel htmlFor={`serving-size-${item.id}`}>Serving Size</InputLabel>
                  <IconButton color="warning"
                    onClick={() => handleServingSizeChange(item.id, item.servingSize)}
                    style={{ position: 'absolute', right: '0', zIndex: 1}}
                  >
                    Reset
                  </IconButton>
                  <IconButton color="secondary" onClick={() => decreaseServingSize(item.id)}>
                    -
                  </IconButton>
                  <Input
                    id={`serving-size-${item.id}`}
                    type="number"
                    value={servingSizes[item.id] || item.servingSize}
                    onChange={(e) => handleServingSizeChange(item.id, parseFloat(e.target.value))}
                    endAdornment={<InputAdornment position="end">{item.servingSizeUnit}</InputAdornment>}
                  />
                  <IconButton color="primary" onClick={() => increaseServingSize(item.id)}>
                    +
                  </IconButton>
                </FormControl>
              </Box>
              <Typography variant="body1"><strong>Calories:</strong> {getNutrientAmount(item.id, "Energy")} kcal</Typography>
              <Typography variant="body1"><strong>Protein:</strong> {getNutrientAmount(item.id, "Protein")} g</Typography>
              <Typography variant="body1"><strong>Carbs:</strong> {getNutrientAmount(item.id, "Carbohydrate, by difference")} g</Typography>
              <Typography variant="body1"><strong>Total Fiber:</strong> {getNutrientAmount(item.id, "Fiber, total dietary")} g</Typography>
              <Typography variant="body1"><strong>Fat:</strong> {getNutrientAmount(item.id, "Total lipid (fat)")} g</Typography>
              <Typography variant="body1"><strong>Sugar:</strong> {getNutrientAmount(item.id, "Total Sugars")} g</Typography>
              <Divider style={{ margin: '20px 0' }} />
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Ingredients</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography>{item.ingredients}</Typography>
                </AccordionDetails>
              </Accordion>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>All Nutrients</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <ul>
                    {nutrients[item.id]?.map((nutrient) => (
                      <li key={nutrient.id}>
                        <strong>{nutrient.name}:</strong> {(nutrient.amount * (servingSizes[item.id] || item.servingSize) / item.servingSize).toFixed(2)} {nutrient.unitName}
                      </li>
                    ))}
                  </ul>
                </AccordionDetails>
              </Accordion>
            </AccordionDetails>
          </Accordion>
        ))}
      </div>
      <div ref={loader}>
        {results.length > 0 && (
          <Box display="flex" justifyContent="center" mt={2}>
            <CircularProgress />
          </Box>
        )}
      </div>
    </Container>
  );
};

export default App;
