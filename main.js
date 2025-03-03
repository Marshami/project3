// main.js

// 1) LOAD CSV & TRANSFORM
d3.csv("data/Mouse_Data_Student_Copy.csv").then(rawData => {
    // rawData is an array of objects. Each object has keys f1,f2,...,f13 and values as strings.
  
    // We add "minute" as the row index (0, 1, 2, ...) so we know time steps
    rawData.forEach((row, i) => {
      row.minute = i; // or i+1 if you prefer 1-based
    });
  
    // WIDE -> LONG
    // For each row, we create a new object for each mouse column (f1, f2, etc.)
    let longData = [];
    rawData.forEach(row => {
      // minute is row.minute
      // each fN is row["fN"]
      // We iterate over all columns except 'minute'
      Object.keys(row).forEach(col => {
        // Skip the 'minute' property and any undefined
        if (col === "minute" || row[col] === undefined) return;
  
        longData.push({
          mouseID: col,                // e.g., 'f1'
          minute: +row.minute,         // integer minute
          temperature: +row[col]       // convert string to number
        });
      });
    });
  
    // Now longData has objects like:
    // { mouseID: "f1", minute: 0, temperature: 37.11 }, ...
  
    // 2) CREATE A MULTI-LINE CHART
    createMultiLineChart(longData);
  
  }).catch(err => {
    console.error("Error loading CSV:", err);
  });
  
  
  // FUNCTION: CREATE MULTI-LINE CHART
  function createMultiLineChart(data) {
    // Dimensions
    const width = 800,
          height = 400,
          margin = { top: 40, right: 120, bottom: 50, left: 60 };
  
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
  
    // Append SVG
    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height);
  
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  
    // We want one line per "mouseID"
    // 1) Group data by mouseID
    const nested = d3.groups(data, d => d.mouseID);
    // nested is an array of [ [mouseID, arrayOfRecords], ... ]
  
    // 2) Determine x/y domains
    // x domain: minute from 0 to max
    const xExtent = d3.extent(data, d => d.minute);
    // y domain: temperature range
    const yExtent = d3.extent(data, d => d.temperature);
  
    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([0, innerWidth]);
  
    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([innerHeight, 0])
      .nice();
  
    // 3) Create a color scale for each mouse
    // We'll use D3's category10 for variety, or pick your own palette
    const mouseIDs = nested.map(([mouseID]) => mouseID);
    const colorScale = d3.scaleOrdinal()
      .domain(mouseIDs)
      .range(d3.schemeCategory10);
  
    // 4) Line generator
    const lineGen = d3.line()
      .x(d => xScale(d.minute))
      .y(d => yScale(d.temperature));
  
    // 5) Draw a <path> for each mouse group
    nested.forEach(([mouseID, records]) => {
      // Sort records by minute if not already sorted
      records.sort((a,b) => d3.ascending(a.minute, b.minute));
  
      g.append("path")
        .datum(records)
        .attr("fill", "none")
        .attr("stroke", colorScale(mouseID))
        .attr("stroke-width", 1.5)
        .attr("d", lineGen)
        .attr("opacity", 0.9);
    });
  
    // 6) Axes
    const xAxis = d3.axisBottom(xScale).ticks(10);
    const yAxis = d3.axisLeft(yScale).ticks(6);
  
    g.append("g")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(xAxis)
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", 40)
      .attr("fill", "black")
      .attr("text-anchor", "middle")
      .text("Minute");
  
    g.append("g")
      .call(yAxis)
      .append("text")
      .attr("x", -innerHeight / 2)
      .attr("y", -50)
      .attr("fill", "black")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .text("Temperature (°C)");
  
    // 7) Optional: Add a legend for each mouse
    const legend = svg.append("g")
      .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);
  
    mouseIDs.forEach((mID, i) => {
      const yPos = i * 20; 
      legend.append("rect")
        .attr("x", 0)
        .attr("y", yPos)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", colorScale(mID));
      legend.append("text")
        .attr("x", 20)
        .attr("y", yPos + 10)
        .style("font-size", "12px")
        .text(mID);
    });
  
    // Title
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .text("Mouse Temperatures Over Time");
  }