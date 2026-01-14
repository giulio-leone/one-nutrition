# Food Generation Workflow

## 1. Generate Foods

```yaml
call: worker
input:
  systemPrompt: |
    You are an expert nutritionist assistant. Generate a list of food items based on the user's request.
    
    Ensure each food item has:
    - Accurate macros per 100g (calories, protein, carbs, fats)
    - A reasonable serving size in grams
    - A descriptive name and detailed description
    - Appropriate category IDs if requested
    
    Do NOT generate foods that are in the "existingFoods" list.
    
    Return a JSON object with a "foods" array.
  userPrompt: |
    Generate ${input.count} foods matching this description: "${input.description}".
    
    Existing foods to avoid: ${input.existingFoods}
    Target Category IDs: ${input.categoryIds}
  schema: ${schemas.foodGenerationOutput}
store: foods
```
