const express = require("express");
const router = express.Router();
const Sequelize = require("sequelize");
const { Op } = require("sequelize");
const { requireAuth, restoreUser } = require("../../utils/auth.js");
const {
  User,
  Spot,
  Booking,
  SpotImage,
  ReviewImage,
  Review,
} = require("../../db/models");

const { check } = require("express-validator");
const { handleValidationErrors } = require("../../utils/validation");
const { route } = require("./users");
const spot = require("../../db/models/spot.js");

// const spot = require("../../db/models/spots");

const validateSpot = [
  check("address")
    .exists({ checkFalsy: true })
    .withMessage("Street address is required"),
  check("city").exists({ checkFalsy: true }).withMessage("City is required"),
  check("state").exists({ checkFalsy: true }).withMessage("State is required"),
  check("country")
    .exists({ checkFalsy: true })
    .withMessage("Country is required"),
  check("lat").exists({ checkFalsy: true }),
  check("lng")
    .exists({ checkFalsy: true })
    .withMessage("Longitude is not valid"),
  check("name")
    .exists({ checkFalsy: true })
    .withMessage("Name is required")
    .isLength({ max: 49 })
    .withMessage("Name must be less than 50 characters"),
  check("description")
    .exists({ checkFalsy: true })
    .withMessage("Description is required"),
  check("price")
    .exists({ checkFalsy: true })
    .withMessage("Price per day is required"),
  handleValidationErrors,
];

const validateReview = [
  check("review")
    .exists({ checkFalsy: true })
    .withMessage("Review text is required"),
  check("stars")
    .exists({ checkFalsy: true })
    .withMessage("Stars is required")
    .isLength({ min: 1, max: 5 })
    .withMessage("Stars must be an integer from 1 to 5"),
  handleValidationErrors,
];

//? GET ALL SPOTS // returns all spots

router.get("/", async (req, res) => {
  let { page, size } = req.query;
  if (!page) {
    page = 1;
  }
  if (!size) {
    size = 20;
  }

  page = parseInt(page);
  size = parseInt(size);

  const pag = {};

  if (size >= 1 && page >= 1) {
    pag.limit = size;
    pag.offset = size * (page - 1);
  } else {
    res.json({
      message: "Validation Error",
      statusCode: 400,
      errors: {
        page: "Page must be greater than or equal to 0",
        size: "Size must be greater than or equal to 0",
        maxLat: "Maximum latitude is invalid",
        minLat: "Minimum latitude is invalid",
        minLng: "Maximum longitude is invalid",
        maxLng: "Minimum longitude is invalid",
        minPrice: "Maximum price must be greater than or equal to 0",
        maxPrice: "Minimum price must be greater than or equal to 0",
      },
    });
  }

  const spots = await Spot.findAll({
    ...pag,
  });

  const spotsArr = [];

  for (let spot of spots) {
    const rating = await Review.findAll({
      where: {
        spotId: spot.id,
      },
      attributes: [[Sequelize.fn("AVG", Sequelize.col("stars")), "avgRating"]],
      raw: true,
    });
    result = {
      ...spot.dataValues,
      avgRating: Number(rating[0].avgRating),
    };
    spotsArr.push(result);
  }

  res.json({ Spots: spotsArr, page, size });
});

//? Get details of a spot from an ID

router.get("/:spotId", async (req, res) => {
  const { spotId } = req.params;

  const spots = await Spot.findByPk(spotId, {
    include: [
      {
        model: User,
        attributes: ["firstName", "lastName", "id"],
      },
      {
        model: SpotImage,
        attributes: ["id", "url", "preview"],
      },
    ],
  });
  if (!spots) {
    res.status(404);
    res.json({ message: "Spot can't be found", statusCode: 404 });
  }
  res.json(spots);
});

//? get spots of current user
router.get('/current', requireAuth, async (req, res) => {
  const spots = await Spot.findAll({
    where: {
      ownerId: req.user.id
    },
    include: [
      {
        model: SpotImage
      }
    ]
  })
  const spotArr = []
  spots.forEach(spot => {
    spotArr.push(spot.toJSON())  
  })
  spots.forEach(spot => {
    spot.SpotImage.forEach(image => {
      if(image.preview === true) {
        spot.previewImage = image.url
      }
    })
    res.json({Spots: spotArr})
  })
});

//? Create a spot

router.post("/", validateSpot, requireAuth, async (req, res) => {
  const ownerId = req.user.id;
  const mySpot = await Spot.create({ ownerId, ...req.body });
  res.json(mySpot);
});

//? create an image for a spot

router.post("/:spotId/images", requireAuth, async (req, res) => {
  const spot = await Spot.findByPk(req.params.spotId);

  const { url, preview } = req.body;

  if (!spot) {
    res.status(404);
    res.json({ message: "Spot couldn't be found", statusCode: 404 });
  }

  const spotImage = await SpotImage.create({
    spotId: spot.id,
    url,
    preview,
  });

  if (!spotImage) {
    res.status(400);
    res.json({
      message: "Need to provide url and preview",
    });
  }

  const spotImages = await SpotImage.findOne({
    where: {
      spotId: req.params.spotId,
    },
  });

  if (!spotImages) {
    res.status(404);
    res.json({
      message: "Image for this spot wasn't created",
    });
  }
  res.json({
    id: spotImage.id,
    url: spotImage.url,
    preview: spotImage.preview,
  });
});

//? edit a spot

router.put("/:spotId", requireAuth, async (req, res) => {
  const { spotId } = req.params;
  const { address, city, state, country, lat, lng, name, description, price } =
    req.params;
  const mySpot = await Spot.findByPk(spotId);

  if (!mySpot) {
    res.status(404);
    res.json({
      message: "Spot couldn't be found",
      statusCode: 404,
    });
  }

  {
    if (address) mySpot.address = address;
    if (city) mySpot.city = city;
    if (state) mySpot.state = state;
    if (country) mySpot.country = country;
    if (lat) mySpot.lat = lat;
    if (lng) mySpot.lng = lng;
    if (name) mySpot.name = name;
    if (description) mySpot.description = description;
    if (price) mySpot.price = price;
  }

  await mySpot.save();
  res.json(mySpot);
});

//? delete a spot

router.delete("/:spotId", requireAuth, async (req, res, next) => {
const spotId = await Spot.findByPk(req.params.spotId, {
  where: {
    userId: req.user.id
  }
})

if(!spotId) {
  res.status(404)
  res.json({
    message: "Spot cannot be found",
    statusCode: 404
  })
}

await spotId.destroy()
res.status(200),
res.json({
  message: "successfully deleted",
  statusCode: 200
})
})

//? Get all Reviews by a Spot's id

router.get("/:spotId/reviews", async (req, res, next) => {
  const spots = await Spot.findByPk(req.params.spotId)

  if(!spots){
    res.status(404)
    res.json({
      message: "Spot cannot be found",
      statusCode: 404
    })
  }
  
  const allReviews = await Review.findAll({
    where: {
      spotId:req.params.spotId
    },
    include: [
      {
        model: User
      },
      {
        model: ReviewImage
      }
    ]
  })
  res.json({
    Reviews: allReviews
  })
});

module.exports = router;