const express = require("express");

const app = express();

app.get("/", (req, res) => {
    res.send("Gowind SMM Panel V3.0 Backend Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server Started on Port " + PORT);
});
