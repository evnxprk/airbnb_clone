const express = require("express");

const { Op } = require("sequelize");
const { check } = require("express-validator");
const { handleValidationErrors } = require("../../utils/validation");
const { requireAuth, restoreUser } = require("../../utils/auth.js");
const {
  Spot,
  User,
  Booking,
  Review,
  ReviewImage,
  SpotImage,
  sequelize,
} = require("../../db/models");
const booking = require("../../db/models/booking");

const router = express.Router();

//?! edit a booking

router.put("/:bookingId", requireAuth, async (req, res, next) => {
  const { bookingId } = req.params;
  const { startDate, endDate } = req.body;
  const myBooking = await Booking.findAll(bookingId);

  if (!myBooking) {
    res.status(404);
    res.json({
      message: "Booking could not be found",
      statusCode: 404,
    });
  }

  if (!startDate || !endDate || endDate <= startDate) {
    res.status(400);
    res.json({
      message: "Validation error",
      statusCode: 400,
      errors: {
        endDate: "endDate cannot come before startDate",
      },
    });
}
if(endDate < myBooking.endDate) {
    res.status(403)
    res.json({
        message: "Past bookings cannot be modified",
        statusCode: 403
    })
}
if((myBooking.startDate >= startDate && myBooking.endDate <= endDate) || booking.startDate <= startDate && myBooking.endDate >= endDate) {
    res.status(403)
    res.json({
      message: "Sorry, this spot is already booked for the specified dates",
      statusCode: 403,
      errors: {
        startDate: "Start date conflicts with an existing booking",
        endDate: "End date conflicts with an existing booking",
      },
    });
} 

myBooking.startDate = startDate
myBooking.endDate = endDate 
booking.save()

res.json(editBooking);

});

//? delete a booking
router.delete("/:bookingId", requireAuth, async (req,res) => {
    const myBooking = await Booking.findByPk(req.params.bookingId)
    const mySpot = await Booking.findByPk(myBooking.spotId)
    if(!myBooking) {
        res.status(404)
        res.json({
            message: "Booking could not be found",
            statusCode: 404
        })
    }

    const newDate = new Date ()

    if(booking.startDate < newDate ) {
        res.status(403)
        res.json({
            message: "Bookings that have start can't be deleted",
            statusCode: 403
        })
    }
    await myBooking.destroy()
    res.status(200)
    res.json({
        message: "Successfully deleted",
        statusCode: 200
    })
})

//? get all of the current user's bookings

router.get("/current", requireAuth, async (req, res) => {
    const myBooking = await Booking.findAll({
        where: {
            userId: req.user.id
        },
        include:[{ 
            model: Spot,
            attributes: {
                exclude: 
                ['createdAt', 'updatedAt', 'description']
            },
        }]
    })

    let bookingsArr = []

    for(let i = 0; i < myBooking.length; i++) {
        const booking = myBooking[i].toJSON()
        // console.log(bookings)
        const previewImage = await SpotImage.findAll({
            where: {
                [Op.and]: [
                    {
                        spotId: booking.spotId
                    },
                    {
                        preview: true
                    }
                ]
            },
            raw: true
        })
        console.log(previewImage)

        if(previewImage[0]) {
            booking.Spot.previewImage = previewImage[0].url
            bookingsArr.push(booking)
        } else {
            booking.Spot.previewImage = null
            bookingsArr.push(booking)
        }
        
    }
    res.json({Bookings:bookingsArr})
})

module.exports = router;
