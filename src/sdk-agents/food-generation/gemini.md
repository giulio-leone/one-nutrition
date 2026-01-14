# Food Generation Agent

Generates structured food items with nutritional information.

## Input

- `count`: Number of items to generate
- `description`: Text description of what to generate (e.g. "High protein vegan snacks")
- `existingFoods`: List of names to exclude to avoid duplicates
- `categoryIds`: Optional list of category IDs to tag or filter by

## Output

List of `GeneratedFood` items with:

- Name, Description
- Macros per 100g
- Serving size
