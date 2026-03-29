const { randomUUID } = require("crypto");
const { nowIso } = require("../data/store");

/**
 * Mock PickupMtaani Courier Service
 * Simulates real courier integration for development/testing
 * In production, this would make actual API calls to PickupMtaani
 */

const mockCourierDeliveries = new Map();
const MOCK_DELIVERY_WINDOW_HOURS = 24; // Simulates 24-hour delivery window

/**
 * Book a delivery with the mock courier
 * @param {Object} params
 * @returns {Object} Booking confirmation
 */
function bookDelivery({
  orderId,
  pickupPointId,
  dropOffLocation,
  itemDescription,
  deliveryFee,
}) {
  if (!orderId || !pickupPointId) {
    return { error: "Missing required delivery parameters", status: 400 };
  }

  const courierBooking = {
    courierBookingId: randomUUID(),
    orderId,
    pickupPointId,
    dropOffLocation: dropOffLocation || "Seller's location",
    itemDescription: itemDescription || "Book from online marketplace",
    deliveryFee,
    status: "BOOKED", // BOOKED, IN_TRANSIT, DELIVERED, FAILED
    estimatedDeliveryTime: new Date(
      Date.now() + MOCK_DELIVERY_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString(),
    trackingUrl: `https://pickup.co.ke/track/${randomUUID()}`,
    confirmedAt: nowIso(),
    dispatchedAt: null,
    deliveredAt: null,
    trackingHistory: [
      {
        timestamp: nowIso(),
        status: "BOOKED",
        message: "Delivery booked successfully",
        location: pickupPointId,
      },
    ],
  };

  mockCourierDeliveries.set(courierBooking.courierBookingId, courierBooking);

  return {
    success: true,
    data: {
      courierBookingId: courierBooking.courierBookingId,
      status: courierBooking.status,
      estimatedDeliveryTime: courierBooking.estimatedDeliveryTime,
      trackingUrl: courierBooking.trackingUrl,
      deliveryFee: deliveryFee,
      message: "Delivery booked. KSH 150 reserved in escrow for courier.",
    },
  };
}

/**
 * Simulate courier picking up item from seller
 * @param {Object} params
 * @returns {Object} Update confirmation
 */
function pickupItem({ courierBookingId, pickupLocation }) {
  const booking = mockCourierDeliveries.get(courierBookingId);
  if (!booking) {
    return { error: "Delivery booking not found", status: 404 };
  }

  if (booking.status !== "BOOKED") {
    return { error: "Can only pickup from BOOKED deliveries", status: 409 };
  }

  booking.status = "IN_TRANSIT";
  booking.dispatchedAt = nowIso();
  booking.trackingHistory.push({
    timestamp: nowIso(),
    status: "IN_TRANSIT",
    message: "Item picked up from seller",
    location: pickupLocation || booking.pickupPointId,
  });

  return {
    success: true,
    data: {
      courierBookingId: courierBookingId,
      status: booking.status,
      dispatchedAt: booking.dispatchedAt,
      message: "Item picked up. Currently in transit to buyer.",
    },
  };
}

/**
 * Simulate courier delivering item to buyer
 * @param {Object} params
 * @returns {Object} Delivery confirmation
 */
function completeDelivery({ courierBookingId, deliveryProof }) {
  const booking = mockCourierDeliveries.get(courierBookingId);
  if (!booking) {
    return { error: "Delivery booking not found", status: 404 };
  }

  if (booking.status !== "IN_TRANSIT") {
    return { error: "Can only complete IN_TRANSIT deliveries", status: 409 };
  }

  booking.status = "DELIVERED";
  booking.deliveredAt = nowIso();
  booking.deliveryProof = deliveryProof || null;
  booking.trackingHistory.push({
    timestamp: nowIso(),
    status: "DELIVERED",
    message: "Item delivered to buyer",
    location: booking.pickupPointId,
  });

  return {
    success: true,
    data: {
      courierBookingId: courierBookingId,
      status: booking.status,
      deliveredAt: booking.deliveredAt,
      message: "Item delivered successfully. Awaiting buyer confirmation.",
    },
  };
}

/**
 * Get tracking/delivery status
 * @param {string} courierBookingId
 * @returns {Object} Delivery status
 */
function getDeliveryStatus(courierBookingId) {
  const booking = mockCourierDeliveries.get(courierBookingId);
  if (!booking) {
    return { error: "Delivery booking not found", status: 404 };
  }

  return {
    success: true,
    data: {
      courierBookingId: courierBookingId,
      orderId: booking.orderId,
      status: booking.status,
      estimatedDeliveryTime: booking.estimatedDeliveryTime,
      dispatchedAt: booking.dispatchedAt,
      deliveredAt: booking.deliveredAt,
      trackingHistory: booking.trackingHistory,
      trackingUrl: booking.trackingUrl,
    },
  };
}

/**
 * Mark delivery as failed (mock only)
 * @param {Object} params
 * @returns {Object} Failure confirmation
 */
function failDelivery({ courierBookingId, failureReason }) {
  const booking = mockCourierDeliveries.get(courierBookingId);
  if (!booking) {
    return { error: "Delivery booking not found", status: 404 };
  }

  if (booking.status === "DELIVERED") {
    return { error: "Cannot fail a delivered item", status: 409 };
  }

  booking.status = "FAILED";
  booking.failureReason = failureReason || "Unknown reason";
  booking.trackingHistory.push({
    timestamp: nowIso(),
    status: "FAILED",
    message: `Delivery failed: ${failureReason}`,
    location: booking.pickupPointId,
  });

  return {
    success: true,
    data: {
      courierBookingId: courierBookingId,
      status: booking.status,
      failureReason: failureReason,
      message: "Delivery marked as failed. Funds returned to escrow.",
    },
  };
}

/**
 * Get all deliveries for an order
 */
function getOrderDeliveries(orderId) {
  const deliveries = Array.from(mockCourierDeliveries.values()).filter(
    (d) => d.orderId === orderId
  );
  return {
    success: true,
    data: deliveries,
  };
}

/**
 * Get delivery statistics (for admin dashboard)
 */
function getDeliveryStats() {
  const allDeliveries = Array.from(mockCourierDeliveries.values());

  const stats = {
    total: allDeliveries.length,
    booked: allDeliveries.filter((d) => d.status === "BOOKED").length,
    inTransit: allDeliveries.filter((d) => d.status === "IN_TRANSIT").length,
    delivered: allDeliveries.filter((d) => d.status === "DELIVERED").length,
    failed: allDeliveries.filter((d) => d.status === "FAILED").length,
    totalFeesCollected: allDeliveries.reduce((sum, d) => sum + (d.deliveryFee || 0), 0),
  };

  return {
    success: true,
    data: stats,
  };
}

module.exports = {
  bookDelivery,
  pickupItem,
  completeDelivery,
  getDeliveryStatus,
  failDelivery,
  getOrderDeliveries,
  getDeliveryStats,
};
