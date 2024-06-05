import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css";
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
  IconButton,
  InputLabel,
  Input,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Divider,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import "tailwindcss/tailwind.css";

let apiUrlBase = `http://127.0.0.1:6262/foodapi`;
if (process.env.NODE_ENV === "production") {
  apiUrlBase = `/foodapi`;
}

const nutrientApiUrl = `${apiUrlBase}/foodNutrients`;

const PAGE_SIZE = 12; // Number of items to fetch per page

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
  foundationalFoodId: number;
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
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true); // Assumes there is more data initially

  const [term, setTerm] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<{ [key: number]: boolean }>({});
  const [nutrients, setNutrients] = useState<{ [key: number]: Nutrient[] }>({});
  const [servingSizes, setServingSizes] = useState<{ [key: number]: number }>(
    {}
  );
  const [allExpanded, setAllExpanded] = useState(false);
  const [searchType, setSearchType] = useState<
    "all" | "branded" | "foundation"
  >("all");
  const loader = useRef<HTMLDivElement | null>(null);

  const searchTimeoutId = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = async () => {
    if (searchTimeoutId.current) {
      clearTimeout(searchTimeoutId.current);
    }

    searchTimeoutId.current = setTimeout(async () => {
      setIsLoading(true);
      let apiUrl = `${apiUrlBase}/searchAll`;
      if (searchType === "branded") {
        apiUrl = `${apiUrlBase}/brandSearch`;
      } else if (searchType === "foundation") {
        apiUrl = `${apiUrlBase}/foundationSearch`;
      }

      try {
        const response = await axios.get<ApiResponse>(apiUrl, {
          params: { term, page, pageSize: PAGE_SIZE },
        });
        const newResults = response.data.data;
        setResults((prevResults) => [...prevResults, ...newResults]);
        const newServingSizes = newResults.reduce((acc, item) => {
          acc[item.id] = item.servingSize;
          return acc;
        }, {} as { [key: number]: number });
        setHasMore(newResults.length === PAGE_SIZE); // Check if there might be more data
        setIsLoading(false);
        setServingSizes((prevSizes) => ({ ...prevSizes, ...newServingSizes }));
      } catch (error) {
        console.error("Error fetching data:", error);
        setIsLoading(false);
      }
    }, 500);
  };

  const loadMore = () => {
    if (!isLoading && hasMore) {
      setPage((prevPage) => prevPage + 1);
    }
  };

  const fetchNutrients = async (
    foodId: number,
    foodType: "branded" | "foundation"
  ) => {
    try {
      const response = await axios.get<NutrientApiResponse>(nutrientApiUrl, {
        params: {
          brandedFoodId: foodType === "branded" ? foodId : undefined,
          foundationalFoodId: foodType === "foundation" ? foodId : undefined,
        },
      });
      setNutrients((prevNutrients) => ({
        ...prevNutrients,
        [foodId]: response.data.data,
      }));
    } catch (error) {
      console.error("Error fetching nutrient data:", error);
    }
  };

  useEffect(() => {
    if (term) {
      handleSearch();
    }
  }, [term, page, searchType]); // Run effect when term, page, or searchType changes

  useEffect(() => {
    const handleObserver = (entities: IntersectionObserverEntry[]) => {
      const target = entities[0];
      if (target.isIntersecting) {
        loadMore();
      }
    };

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "20px",
      threshold: 1.0,
    });

    if (loader.current) {
      observer.observe(loader.current);
    }

    return () => {
      if (loader.current) {
        observer.unobserve(loader.current);
      }
    };
  }, [isLoading, hasMore]); // Include isLoading and hasMore in the dependencies array

  const toggleExpand = (id: number, foodType: "branded" | "foundation") => {
    if (!expanded[id]) {
      fetchNutrients(id, foodType);
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
        fetchNutrients(
          item.id,
          item.foodClass === "Branded" ? "branded" : "foundation"
        );
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

  const getNutrientAmount = (foodId: number, nutrientName: string) => {
    const nutrient = nutrients[foodId]?.find((n) => {
      if (n.name === "Energy") {
        return n.name === nutrientName && n.unitName === "kcal";
      }
      return n.name === nutrientName;
    });
    if (nutrient) {
      const servingSize =
        servingSizes[foodId] ||
        results.find((item) => item.id === foodId)?.servingSize;
      if (servingSize) {
        const servingSizeFactor =
          servingSize /
          results.find((item) => item.id === foodId)?.servingSize!;
        return (nutrient.amount * servingSizeFactor).toFixed(2);
      }
    }
    return "0";
  };

  const handleFilterChange = (
    newSearchType: "all" | "branded" | "foundation"
  ) => {
    setSearchType(newSearchType);
    setResults([]);
    setPage(1);
    setExpanded({});
    setNutrients({});
  };

  return (
    <Container>
      <CssBaseline />
      <Box display="flex" justifyContent="center" mt={2}>
        <img
          src="logo512.png"
          alt="logo"
          width="100"
          className="hover:scale-110 hover:rotate-3 hover:hue-rotate-15 cursor-pointer bounce-once transition-transform duration-600"
          onClick={(e) => {
            // re-add bounce-once class to trigger animation
            if (e.currentTarget.classList.contains("bounce-once")) {
              e.currentTarget.classList.remove("bounce-once");
              e.currentTarget.classList.add("spin-once");
            } else if (e.currentTarget.classList.contains("spin-once")) {
              e.currentTarget.classList.remove("spin-once");
              e.currentTarget.classList.add("bounce-once");
            }
          }}
        />
      </Box>
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
      <Box display="flex" justifyContent="center" mb={2}>
        <FormControlLabel
          control={
            <Checkbox
              checked={searchType === "all"}
              onChange={() => handleFilterChange("all")}
              name="all"
              color="primary"
            />
          }
          label="All"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={searchType === "branded"}
              onChange={() => handleFilterChange("branded")}
              name="branded"
              color="primary"
            />
          }
          label="Branded"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={searchType === "foundation"}
              onChange={() => handleFilterChange("foundation")}
              name="foundation"
              color="primary"
            />
          }
          label="Foundation"
        />
      </Box>
      <Button
        variant="contained"
        color="primary"
        onClick={toggleExpandAll}
        style={{ marginBottom: "20px" }}
      >
        {allExpanded ? "Collapse All" : "Expand All"}
      </Button>
      <div>
        {results.map((item) => (
          <Accordion
            key={item.id}
            expanded={!!expanded[item.id]} // Ensure it's always a boolean
            onChange={() =>
              toggleExpand(
                item.id,
                item.foodClass === "Branded" ? "branded" : "foundation"
              )
            }
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">{item.description}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box mb={2}>
                <FormControl variant="outlined" fullWidth>
                  <InputLabel htmlFor={`serving-size-${item.id}`}>
                    Serving Size
                  </InputLabel>
                  <IconButton
                    color="warning"
                    onClick={() =>
                      handleServingSizeChange(item.id, item.servingSize)
                    }
                    style={{ position: "absolute", right: "0", zIndex: 1 }}
                  >
                    Reset
                  </IconButton>
                  <IconButton
                    color="secondary"
                    onClick={() => decreaseServingSize(item.id)}
                  >
                    -
                  </IconButton>
                  <Input
                    id={`serving-size-${item.id}`}
                    type="number"
                    value={servingSizes[item.id] || item.servingSize}
                    onChange={(e) =>
                      handleServingSizeChange(
                        item.id,
                        parseFloat(e.target.value)
                      )
                    }
                    endAdornment={
                      <InputAdornment position="end">
                        {item.servingSizeUnit}
                      </InputAdornment>
                    }
                  />
                  <IconButton
                    color="primary"
                    onClick={() => increaseServingSize(item.id)}
                  >
                    +
                  </IconButton>
                </FormControl>
              </Box>
              <Typography variant="body1">
                <strong>Calories:</strong>{" "}
                {getNutrientAmount(item.id, "Energy")} kcal
              </Typography>
              <Typography variant="body1">
                <strong>Protein:</strong>{" "}
                {getNutrientAmount(item.id, "Protein")} g
              </Typography>
              <Typography variant="body1">
                <strong>Carbs:</strong>{" "}
                {getNutrientAmount(item.id, "Carbohydrate, by difference")} g
              </Typography>
              <Typography variant="body1">
                <strong>Total Fiber:</strong>{" "}
                {getNutrientAmount(item.id, "Fiber, total dietary")} g
              </Typography>
              <Typography variant="body1">
                <strong>Fat:</strong>{" "}
                {getNutrientAmount(item.id, "Total lipid (fat)")} g
              </Typography>
              <Typography variant="body1">
                <strong>Sugar:</strong>{" "}
                {getNutrientAmount(item.id, "Total Sugars")} g
              </Typography>
              <Divider style={{ margin: "20px 0" }} />
              {item.foodClass === "Branded" && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>Ingredients</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography>{item.ingredients}</Typography>
                  </AccordionDetails>
                </Accordion>
              )}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>All Nutrients</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <ul>
                    {nutrients[item.id]?.map((nutrient) => (
                      <li key={nutrient.id}>
                        <strong>{nutrient.name}:</strong>{" "}
                        {(
                          (nutrient.amount *
                            (servingSizes[item.id] || item.servingSize)) /
                          item.servingSize
                        ).toFixed(2)}{" "}
                        {nutrient.unitName}
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
        {isLoading && (
          <Box
            display="flex"
            justifyContent="center"
            mt={2}
            className="min-h-16"
          >
            <CircularProgress />
          </Box>
        )}
      </div>
    </Container>
  );
};

export default App;
