import express from "express";
import request from "supertest";
import discoverRouter from "../src/routes/discover.js";

const app = express();
app.use("/api", discoverRouter);

async function test() {
  console.log("Hitting the /api/movies/popular endpoint...");
  
  const response = await request(app).get("/api/movies/popular?page=1");
  
  if (response.body && response.body.length > 0) {
    console.log(`\nSuccessfully fetched ${response.body.length} movies!`);
    console.log("Here are the first 2 movies in the payload:\n");
    console.log(JSON.stringify(response.body.slice(0, 2), null, 2));
  } else {
    console.log("No movies returned or error:", response.body);
  }
}

test();
