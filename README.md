# Flourish customized control sheet demo

Using the concept of the control sheet moves API chart configurations from code to a spreadsheet, allowing non-technical users to control and maintain API charts. The control sheet is a flexible concept, not a recipe, and there are multiple ways of implementing a control sheet.

This demo covers a specific implementation, exposing a small set of Flourish bindings and settings for Line, Bar, and Pie charts in a simple way. See [here](TODO LINK) for a more generic and flexible example allowing any chart to be built and changed; however, it comes with more complexities.

## Control sheet mechanics

[`app.js`](app.js) reads in a data sheet from [`data/data-sheet.csv`](data/data-sheet.csv) and the control sheet from [`data/control-sheet.csv`](data/control-sheet.csv) to compose the application.

**Each row** of the control sheet represents a chart being built, and **each column** configures either the placement, the Flourish bindings, or the Flourish settings of the chart.

The charts in this example are additionally organized in sections as specified in the control sheet. Each section can hold a set of charts that can be navigated to via a button.

## Control sheet columns

The following documents each column of the given [control sheet](data/control-sheet.csv).

### Layout

`section`: Defines the sections for all charts.

`container`: The CSS selector for each section as specified in `index.html`.

`chart_index`: Integer representation of each section.

`chart_label`: Section buttons' title.

### Base chart settings

`base_chart`: A Flourish chart ID of a published Flourish chart. The base chart's information is pulled in to set the chart's template, version, base settings, bindings, and data. Control sheet exposed options can be changed by the control sheet user.

`direct_chart`: A Flourish chart ID of a published Flourish chart that does get embedded directly rather than built by the live API. Useful escape hatch if you want to show a chart as is without any control sheet or data configurations.

`chart_type`: This example only works with the [Line, Bar, Pie template](https://app.flourish.studio/@flourish/line-bar-pie/24#chart_type), which allows you to specify different types of charts.

### Bindings

Set selected bindings as documented in the _Template Data_ section of each template's API documentation, like [for example here](https://app.flourish.studio/@flourish/line-bar-pie/24#api-template-data-header).

`label`: Setting the `label` binding of the template.

`value`: Setting the `value` binding of the template.

Note that this will only work with templates that expose these bindings. The code can be updated to include different bindings for different templates.

### Data

`filter`: Basic data filtering following the syntax `column_name :: operator :: value`. For example, `country :: eq :: Wakanda` only includes rows with the value `Wakanda` in the `country` column. Possible operators in this implementation are `eq` (_equal to_) and `neq` (_not equal to_). This can be extended in the code.

### Settings

The following columns allow the user to set Flourish settings as specified in the Template Settings section of each template's API documentation, like [for example here](https://app.flourish.studio/@flourish/line-bar-pie/24#api-template-settings-header).

`title`: Set the visualization title.

`subtitle`: Set the visualization subtitle.

`facet`: Any cell input like e.g., `"yes"` will build a faceted chart (if the template exposes the [`facet_layout`](https://app.flourish.studio/@flourish/line-bar-pie/24#facet_layout) setting).

`x_label`: Set the x label of the chart.

`y_label`: Set the y label of the chart.

`legend`: Switch the chart legend off (no value), to single mode (`"single"`), or to multi mode (`"multi"`).

`color_overrides`: Set any desired color overrides.

Note that this will only work with templates that expose these settings. The code can be updated to include different settings for different templates.
