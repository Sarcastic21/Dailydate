const express = require("express");
const ImageKit = require("imagekit");
const router = express.Router();

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Generate auth parameters for client-side upload
router.get("/auth", (req, res) => {
    const authParams = imagekit.getAuthenticationParameters();
    res.json(authParams);
});

module.exports = router;
