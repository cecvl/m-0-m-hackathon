const { z } = require("zod");
const { createListing, listBooks } = require("../services/listingService");
const { ok, fail } = require("../utils/response");

const listingSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  isbn: z.string().optional(),
  condition: z.enum(["New", "Like New", "Good", "Fair"]),
  price: z.number().int().min(1).max(500),
  description: z.string().min(10),
  sellerPhone: z.string().min(10),
});

async function createListingHandler(req, res) {
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, "Invalid listing payload", 422, parsed.error.flatten());
  }

  const listing = await createListing(parsed.data);
  return ok(res, listing, 201);
}

async function listBooksHandler(req, res) {
  const books = await listBooks(req.query.q || "");
  return ok(res, books);
}

module.exports = {
  createListingHandler,
  listBooksHandler,
};
