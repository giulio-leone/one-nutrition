# Nutrition Generation Workflow

This workflow orchestrates multiple specialized agents to generate a complete personalized nutrition plan.

## 1. Calculate Daily Macros

```yaml
transform: calculateDailyMacros
input:
  userProfile: ${input.userProfile}
  goals: ${input.goals}
store: dailyMacros
```

## 2. Distribute Meal Macros

```yaml
transform: distributeMealMacros
input:
  dailyMacros: ${artifacts.dailyMacros}
  mealsPerDay: ${input.goals.mealsPerDay}
store: mealTargets
```

## 3. Plan Daily Structure

```yaml
call: workers/meal-planner
input:
  goals: ${input.goals}
  restrictions: ${input.restrictions}
  mealTargets: ${artifacts.mealTargets}
store: mealStructure
```

## 4. Select Foods

```yaml
call: workers/food-selector
input:
  mealTargets: ${artifacts.mealTargets}
  mealStructure: ${artifacts.mealStructure}
  restrictions: ${input.restrictions}
  foodCatalog: ${input.foodCatalog}
store: selectedFoods
```

## 5. Generate Patterns in Parallel

```yaml
loop:
  over: [A, B, C]
  itemVar: patternCode
  mode: parallel
  outputKey: composedPatterns
  maxItems: ${input.goals.patternsCount}
  steps:
    - call: workers/pattern-generator
      input:
        patternCode: ${artifacts.patternCode}
        mealTargets: ${artifacts.mealTargets}
        selectedFoods: ${artifacts.selectedFoods}
        restrictions: ${input.restrictions}
        userProfile: ${input.userProfile}
      store: patternResult
```

## 6. Validate Plan

```yaml
call: workers/validator
input:
  patterns: ${artifacts.composedPatterns}
  dailyMacros: ${artifacts.dailyMacros}
  goals: ${input.goals}
  mealTargets: ${artifacts.mealTargets}
store: validationResult
```

## 7. Assemble Final Plan

```yaml
transform: assemblePlan
input:
  patterns: ${artifacts.composedPatterns}
  dailyMacros: ${artifacts.dailyMacros}
  mealTargets: ${artifacts.mealTargets}
  userProfile: ${input.userProfile}
  goals: ${input.goals}
  restrictions: ${input.restrictions}
  userId: ${input.userId}
store: finalPlan
```
