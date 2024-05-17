/* API KEY */
const API_KEY = "<INSERT YOUR API KEY HERE>";

/* Globals */
let baseChartConfig = null;
let chartDataMap = null;
let sections = null;

/* Data prep */
function parseFilter(string) {
  // Splits potential filter keywords into their properties.
  return string
    .replace(/\s/g, "")
    .split(",")
    .map((d) => {
      const innerSplit = d.split("::");
      return {
        variable: innerSplit[0],
        operator: innerSplit[1] || "eq",
        value: innerSplit[2],
      };
    });
}

function prepControlData(data) {
  // Recode the comma seperated `value` column into an array (as expected by the Live API function)
  // and parse the `filter` column for further use later in the code.
  return data.map((d) => ({
    ...d,
    value: d.value ? d.value.split(",").map((dd) => dd.trim()) : d.value,
    filter: d.filter ? parseFilter(d.filter) : d.filter,
  }));
}

async function getBaseChartConfig(controlData) {
  // Collect all unique base chart id's
  const baseCharts = d3
    .groups(controlData, (d) => d.base_chart)
    .filter((d) => d[0]);

  // Fetch all base charts' JSON structured info
  const baseChartPromises = baseCharts.map((d) =>
    d3.json(
      `https://public.flourish.studio/visualisation/${d[0]}/visualisation.json`
    )
  );
  const baseChartData = await Promise.all(baseChartPromises);

  // Create a Map so we can easily retrieve each base chart's info by its ID
  const config = baseChartData.map((d, i) => [
    baseCharts[i][0],
    {
      name: d.name,
      template: d.template,
      version: d.version,
      state: _.cloneDeep(d.state),
    },
  ]);

  return new Map(config);
}

function prepChartData(data) {
  return d3.group(data, (d) => d.chart_index);
}

function predicate(variable, value, operator) {
  if (operator === "eq") return variable === value;
  if (operator === "neq") return variable !== value;
}

function prepRowData(data, controlData) {
  if (!controlData.filter) return data;

  // Every predicate in filter must return true. Note this can only take simple
  // conditional chaining (true && false && ...) vs. (true && (true || false)).
  return data.filter((row) => {
    return controlData.filter.every((f) =>
      predicate(row[f.variable], f.value, f.operator)
    );
  });
}

/* Live API configuration mutation function */
function setFacet(facet, state) {
  if (facet) state.state.facet_layout = "facets";
}

function parseForColNames(data, string) {
  // If there's a string and there are {curly braces}
  if (string && string.match(/{.+}/)) {
    // Get the braces content and use them as variable names to
    // retrieve their content from the datasheet (e.g. data["question"])
    const variable = string.match(/[^{}]*(?=\})/g).filter((d) => d);
    return variable.map((d) => data[0][d]).join(" ");
  }
  return string;
}

function setChartType(controlData, state) {
  if (controlData.chart_type) state.state.chart_type = controlData.chart_type;
}

function setTitles(controlData, state, data) {
  state.state.layout.title = parseForColNames(data, controlData.title);
  state.state.layout.subtitle = parseForColNames(data, controlData.subtitle);
}

function setAxisLabels(controlData, state) {
  state.state.x.title = controlData.x_label ? controlData.x_label : "";
  state.state.y.title = controlData.y_label ? controlData.y_label : "";
}

function setLegend(controlData, state) {
  if (!controlData.legend) return;

  state.state.legend_mode = "on";
  if (controlData.legend === "single")
    state.state.legend_filter_mode = "filter-in";
  if (controlData.legend === "multi")
    state.state.legend_filter_mode = "filter-out";
}

function setColorOverrides(controlData, state) {
  if (controlData.color_overrides)
    state.state.color.categorical_custom_palette = controlData.color_overrides;
}

function mutateOptions(controlData, state, data) {
  // Just a collection function running all state mutation functions defined above.
  setChartType(controlData, state);
  setFacet(controlData.facet, state);
  setTitles(controlData, state, data);
  setAxisLabels(controlData, state);
  setLegend(controlData, state);
  setColorOverrides(controlData, state);
}

/* DOM build */
function setActiveChart(parent, controlData) {
  parent
    .select(".viz-base-chart")
    .classed("active-chart", controlData.base_chart);
  parent
    .select(".viz-direct-chart")
    .classed("active-chart", controlData.direct_chart);
}

function buildAPIChart(controlData) {
  // Compose the API options.
  const config = baseChartConfig.get(controlData.base_chart);

  // Setting the API chart base configurations. Note that the template
  // and the version come from the base chart config and not the control sheet.
  const base = {
    api_key: API_KEY,
    template: config.template,
    version: config.version,
    container: `${controlData.container} .viz-base-chart`,
  };

  // The settings (`state`) are being taken straight from the base chart config.
  const state = {
    state: _.cloneDeep(config.state),
  };

  // Setting up the bindings. Note, this set up works
  // with the LBP template.
  const bindings = {
    bindings: {
      data: {
        label: controlData.label,
        value: controlData.value,
        metadata: [], // assuming no custom popup data for simplicity
      },
    },
  };

  // The data can be filtered via the control sheet's `filter` column.
  // See `prepRowData` function comments for more.
  const dataOriginal = chartDataMap.get(controlData.chart_index);
  const dataPrepped = prepRowData(dataOriginal, controlData);

  const data = {
    data: {
      data: dataPrepped,
    },
  };

  // This function changes settings with custom functions set above
  // if the control sheet includes specific changes.
  mutateOptions(controlData, state, dataPrepped);

  // Compose the final Live API options object
  const apiOptions = {
    ...base,
    ...state,
    ...bindings,
    ...data,
    ...{ metadata: {} }, // type metadata will be template guessed for simplicity
  };

  console.log(apiOptions);

  // Build the chart.
  const currentSectionValue = sections.get(controlData.section);
  const hasVisual = currentSectionValue.hasOwnProperty("visual");

  // Build on initial load but update on update :)
  if (!hasVisual) {
    // This mutates the section map's value.
    currentSectionValue.visual = new Flourish.Live(apiOptions);
  } else {
    currentSectionValue.visual.update(apiOptions);
  }
}

function buildDirectChart(controlData) {
  const directChartContainer = d3.select(
    `${controlData.container} .viz-direct-chart`
  );

  // if (directChartContainer.selectAll('*').size()) return;
  // TODO: improve and update only if new chart. Return if user wants to rebuild same chart.
  directChartContainer.selectAll("*").remove();

  directChartContainer
    .append("iframe")
    .attr(
      "src",
      `https://flo.uri.sh/visualisation/${controlData.direct_chart}/embed`
    )
    .attr("title", "Interactive or visual content")
    .attr("class", "flourish-embed-iframe")
    .attr("frameborder", "0")
    .attr("scrolling", "no")
    .attr(
      "sandbox",
      "allow-same-origin allow-forms allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
    )
    .style("width", "100%")
    .style("height", "100%");
}

function buildVisual(controlData) {
  // Check what type of chart to build. If the control sheet has a `base_chart` column set, the
  // chart will be API produced. If a `direct_chart` column is set, the chart will be embedded.
  if (controlData.base_chart) buildAPIChart(controlData);
  if (controlData.direct_chart) buildDirectChart(controlData);
  if (!controlData.base_chart && !controlData.direct_chart)
    throw new Error(
      "Please assign either a base_chart or a direct_chart visualization id"
    );
}

function buildContols(sel, data) {
  sel.append("div").attr("class", "viz-nav-title");
  const sectionButtons = sel
    .selectAll("chart-button")
    .data(data)
    .join("button")
    .attr("class", "viz-nav-option")
    .html((d) => d.chart_label);

  sectionButtons.filter(function (d, i) {
    return d3.select(this).classed("selected", !i);
  });

  sectionButtons.on("click", function () {
    // Button styles.
    d3.select(this.parentNode)
      .selectAll(".viz-nav-option")
      .classed("selected", false);
    const selected = d3.select(this).classed("selected");
    d3.select(this).classed("selected", !selected);

    // Build the chart.
    const chartControlData = d3.select(this).datum();
    buildVisual(chartControlData);

    // Change chart visibility.
    const parent = d3.select(this.closest(".df-viz"));
    setActiveChart(parent, chartControlData);
  });
}

function buildSection(controlData) {
  const { container } = controlData[0];

  // Build the DOM for each section
  const sectionContainer = d3
    .select(container)
    .append("div")
    .attr("class", "df-viz");
  sectionContainer
    .append("div")
    .attr("class", "viz-nav")
    .call(buildContols, controlData);

  const chartContainer = sectionContainer
    .append("div")
    .attr("class", "viz-chart");
  chartContainer.append("div").attr("class", "viz-base-chart");
  chartContainer.append("div").attr("class", "viz-direct-chart");

  // Build first chart and set visibility.
  buildVisual(controlData[0]);
  setActiveChart(chartContainer, controlData[0]);
}

/* Main */
async function main(controlData, data) {
  // Get all base chart data.
  chartDataMap = prepChartData(data);
  const controlDataPrepped = prepControlData(controlData);
  baseChartConfig = await getBaseChartConfig(controlDataPrepped);
  sections = d3.group(controlDataPrepped, (d) => d.section);

  // Build sections.
  sections.forEach(buildSection);
}

// Get data (with cache busting query parameter).
const chartInfo = d3.csv(`data/control-sheet.csv?${Math.random()}`);
const chartData = d3.csv(`data/data-sheet.csv?${Math.random()}`);

Promise.all([chartInfo, chartData]).then((res) => main(res[0], res[1]));
