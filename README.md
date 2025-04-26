AOW

1.  **Architecture Overview**
2.  **Database Design (MongoDB Schemas)**
3.  **API Design (Endpoints & Request/Response)**
4.  **Backend Module Breakdown (Node.js/Express)**
5.  **Frontend Component Breakdown (React)**
6.  **Key Technical Implementations**
    *   Authentication & Authorization (JWT, Redis)
    *   File Uploads (Multer, Cloud Storage)
    *   Search & Filtering
    *   Real-time Messaging (Socket.io, Redis)
    *   Caching Strategy (Redis)
    *   Payment Gateway Integration (Razorpay)
    *   Admin Functionality
    *   Background Tasks (Redis Queues - Optional but recommended)
7.  **Error Handling**
8.  **Security Considerations**
9.  **Deployment Considerations**

---

## 1. Architecture Overview

The system follows a standard client-server architecture with a decoupled frontend and backend.

*   **Frontend (React):** Single Page Application (SPA) handling the user interface, user interactions, and consuming backend APIs.
*   **Backend (Node.js/Express):** Provides RESTful APIs for data operations, handles business logic, interacts with the database, and manages file uploads.
*   **Database (MongoDB):** Primary data store for all persistent data (users, listings, reviews, messages, etc.). MongoDB Atlas is recommended for production for scalability and management.
*   **Caching & Session Store (Redis):** Used for storing user sessions, caching frequently accessed data (e.g., master data, featured listings), and potentially as a message broker for real-time features or queueing background jobs.
*   **Real-time Communication (Socket.io):** Layer on top of Express for real-time features like the chat system. Can leverage Redis Pub/Sub for scaling across multiple Node.js instances.
*   **File Storage (Cloud Storage):** External service like AWS S3, Google Cloud Storage, or Cloudinary to store uploaded images and documents. This is preferred over local storage for scalability, reliability, and ease of serving.
*   **External Services:**
    *   Payment Gateway (Razorpay): For handling online payments (subscriptions, promotions).
    *   Email Service (SendGrid, Nodemailer with SMTP): For transactional emails (OTP, inquiries, notifications).
    *   SMS Gateway (Twilio, MSG91): For mobile OTP verification and potentially notifications.
    *   Mapping Service (Google Maps API): For location selection, display, and geo-search.

```
+-------------+     +-------------+     +-----------------+
|             |     |             |     |                 |
|   Browser   |     |   React     |     |   Node.js/      |
|             |---->|  Frontend   |---->|    Express      |
| (User UI)   |     |             |     |    Backend      |
|             |     |             |     |                 |
+-------------+     +------+------+     +--------+--------+
                           |                     |
                           | REST API /          | Mongoose
                           | WebSockets          |
                           |                     |
                 +---------+----------+    +----+-----+
                 |                    |    |          |
                 |       Internet     |    | MongoDB  |
                 |                    |    | Database |
                 +---------+----------+    |          |
                           |                 +----+-----+
                           |                 |
                 +---------+----------+    |
                 |                    |    | Redis
                 |   External Services|----+ (Cache, Sessions, Pub/Sub)
                 | (S3, Razorpay,     |
                 |  Email, SMS, Maps) |
                 +--------------------+
```

## 2. Database Design (MongoDB Schemas)

Using Mongoose for schema definition and interaction. Each top-level bullet point represents a MongoDB Collection.

*   **`users`**
    *   `_id`: ObjectId (Primary Key)
    *   `email`: String (Unique, Indexed)
    *   `password`: String (Hashed)
    *   `mobile`: String (Optional, Unique, Indexed)
    *   `mobile_otp`: String (Optional)
    *   `mobile_otp_expires`: Date (Optional)
    *   `googleId`: String (Optional, Indexed)
    *   `facebookId`: String (Optional, Indexed)
    *   `name`: String
    *   `role`: String (Enum: 'user', 'business', 'admin')
    *   `address`: { street: String, city: String, state: String, postalCode: String } (Optional)
    *   `is_verified`: Boolean (Default: false)
    *   `status`: String (Enum: 'active', 'inactive', 'suspended')
    *   `created_at`: Date (Default: now)
    *   `updated_at`: Date (Default: now)
    *   `last_login_at`: Date (Optional)
    *   `business_profile_id`: ObjectId (Ref: `businesses`, Optional, if role is 'business')
    *   `saved_listings`: [ObjectId] (Refs: `vehicles`, `businesses`, `classifieds`)

*   **`master_data`** (Single document or multiple documents per type)
    *   `_id`: ObjectId (e.g., could be `vehicleTypes`, `usedFor`, `brands`, etc.)
    *   `type`: String (e.g., 'vehicle_type', 'used_for', 'vehicle_brand', 'transmission', etc.)
    *   `values`: [ { name: String, slug: String (Optional), parent: ObjectId (Optional, Ref: `master_data`) } ]
    *   *Example:* `{ _id: ObjectId("..."), type: 'vehicle_type', values: [ {name: 'Cars'}, {name: 'Bikes'} ] }`
    *   *Example:* `{ _id: ObjectId("..."), type: 'vehicle_brand', values: [ {name: 'Toyota'}, {name: 'Honda'} ] }`
    *   *Example:* `{ _id: ObjectId("..."), type: 'vehicle_model', values: [ {name: 'Camry', parent: <ObjectId of Toyota> }, {name: 'Civic', parent: <ObjectId of Honda>} ] }`

*   **`vehicles`**
    *   `_id`: ObjectId
    *   `owner_id`: ObjectId (Ref: `users`, Indexed)
    *   `status`: String (Enum: 'draft', 'pending_approval', 'active', 'sold', 'expired', 'rejected')
    *   `is_featured`: Boolean (Default: false)
    *   `is_promoted`: Boolean (Default: false) // For paid boosting
    *   `type`: String (Ref: `master_data`, type 'vehicle_type')
    *   `used_for`: [String] (Refs: `master_data`, type 'used_for')
    *   `brand`: String (Ref: `master_data`, type 'vehicle_brand')
    *   `model`: String (Ref: `master_data`, type 'vehicle_model' OR String)
    *   `variant`: String (Optional)
    *   `registration_state`: String (Ref: `master_data`, type 'registration_state')
    *   `accident_history`: { happened: Boolean, details: String (Optional) }
    *   `odometer`: Number (Indexed)
    *   `features`: [String] // Open option
    *   `images`: { interior: [String], exterior: [String], upgrades: [String], scratches: [String], tires: [String], features: [String], other: [String] } // Store file paths/URLs
    *   `owner_type`: String (Enum: 'Personal', 'Commercial')
    *   `special_achievements`: String (Optional)
    *   `registration_date`: Date
    *   `km_driven`: Number (Indexed)
    *   `transmission`: String (Ref: `master_data`, type 'transmission')
    *   `fuel_type`: String (Ref: `master_data`, type 'fuel_type')
    *   `insurance`: { has_insurance: Boolean, valid_till: Date (Optional) }
    *   `upgrades_done`: [ { type: String (Ref: `master_data`, type 'upgrade_type'), details: String } ] // Up to 10
    *   `rally_participation`: { participated: Boolean, recent_rallies: [String] (Optional, up to 10, Refs: `master_data`, type 'rally_name') }
    *   `selling_price`: Number (Optional, Indexed)
    *   `lets_discuss_price`: Boolean (Default: false)
    *   `contact_details`: { phone: [String], mobile: [String], whatsapp: String, email: String, show_email: Boolean (Default: false) } // Override user defaults
    *   `location`: { type: String (Enum: 'Point'), coordinates: [Number] } // GeoJSON for geo-spatial queries (Indexed: 2dsphere)
    *   `location_name`: String (User-friendly location text)
    *   `description`: String
    *   `posted_at`: Date (Default: now, Indexed)
    *   `expires_at`: Date (Calculated based on plan/default)
    *   `views_count`: Number (Default: 0)
    *   `inquiry_count`: Number (Default: 0)

*   **`businesses`**
    *   `_id`: ObjectId
    *   `owner_id`: ObjectId (Ref: `users`, Indexed, `role` must be 'business')
    *   `status`: String (Enum: 'draft', 'pending_approval', 'active', 'rejected')
    *   `is_verified`: Boolean (Default: false) // Requires KYC check by admin
    *   `subscription_plan_id`: ObjectId (Ref: `subscription_plans`)
    *   `name`: String
    *   `logo`: String // File path/URL
    *   `years_of_establishment`: Number (Optional)
    *   `description`: String // Up to 2000 words
    *   `services_offered`: [ { category: String (Ref: `master_data`, type 'service_category'), subcategories: [String] (Refs: `master_data`, type 'service_subcategory') } ]
    *   `contact_details`: { phone: [String], mobile: [String], whatsapp: String, email: String, show_email: Boolean (Default: false) } // Can have multiple phone/mobile
    *   `locations`: [ { state: String, city: String, address: String, phone: [String], mobile: [String], whatsapp: String, google_maps_url: String, location: { type: String, coordinates: [Number] } (Indexed: 2dsphere) } ] // Multiple locations
    *   `pricing_packages`: [ { name: String, description: String, price: String } ] // Up to ~10
    *   `images_videos`: [ { type: String (Enum: 'image', 'video'), url: String } ] // File paths/URLs
    *   `social_media_links`: [ { platform: String, url: String } ]
    *   `average_rating`: Number (Calculated, Default: 0)
    *   `review_count`: Number (Calculated, Default: 0)
    *   `posted_at`: Date (Default: now, Indexed)
    *   `expires_at`: Date (Calculated based on plan/default)
    *   `views_count`: Number (Default: 0)
    *   `inquiry_count`: Number (Default: 0)

*   **`events`**
    *   `_id`: ObjectId
    *   `owner_id`: ObjectId (Ref: `users`, Optional, Indexed) // Could be a user or linked to a business
    *   `status`: String (Enum: 'draft', 'pending_approval', 'active', 'past', 'rejected')
    *   `title`: String
    *   `description`: String
    *   `category`: String (Ref: `master_data`, type 'event_category')
    *   `start_date`: Date (Indexed)
    *   `end_date`: Date (Optional)
    *   `location`: { type: String, coordinates: [Number] } (Indexed: 2dsphere)
    *   `location_name`: String (User-friendly location text)
    *   `downloads`: [ { name: String, url: String } ] // File paths/URLs for brochure, form etc.
    *   `pricing_info`: String // Text field for pricing details
    *   `images`: [String] // File paths/URLs
    *   `posted_at`: Date (Default: now)
    *   `views_count`: Number (Default: 0)

*   **`classifieds`**
    *   `_id`: ObjectId
    *   `owner_id`: ObjectId (Ref: `users`, Indexed)
    *   `status`: String (Enum: 'draft', 'pending_approval', 'active', 'sold', 'expired', 'rejected')
    *   `is_promoted`: Boolean (Default: false)
    *   `title`: String
    *   `description`: String
    *   `category`: String (Ref: `master_data`, type 'classified_category')
    *   `price`: Number
    *   `location`: { type: String, coordinates: [Number] } (Indexed: 2dsphere)
    *   `location_name`: String (User-friendly location text)
    *   `images`: [String] // File paths/URLs
    *   `contact_options`: { chat: Boolean, call: Boolean, whatsapp: Boolean, email: Boolean } // Seller preference
    *   `posted_at`: Date (Default: now, Indexed)
    *   `expires_at`: Date (Calculated based on plan/default)
    *   `views_count`: Number (Default: 0)
    *   `inquiry_count`: Number (Default: 0)

*   **`reviews`**
    *   `_id`: ObjectId
    *   `reviewer_id`: ObjectId (Ref: `users`, Indexed)
    *   `listing_id`: ObjectId (Indexed) // Could be `vehicles`, `businesses`, `classifieds`
    *   `listing_type`: String (Enum: 'vehicle', 'business', 'classified', Indexed) // Helps with querying
    *   `rating`: Number (1-5)
    *   `comment`: String
    *   `status`: String (Enum: 'pending_moderation', 'approved', 'rejected')
    *   `posted_at`: Date (Default: now)
    *   `updated_at`: Date (Default: now)

*   **`inquiries`**
    *   `_id`: ObjectId
    *   `sender_id`: ObjectId (Ref: `users`, Indexed)
    *   `receiver_id`: ObjectId (Ref: `users`, Indexed) // Owner of the listing
    *   `listing_id`: ObjectId (Indexed) // Could be `vehicles`, `businesses`, `classifieds`
    *   `listing_type`: String (Enum: 'vehicle', 'business', 'classified', Indexed)
    *   `message`: String
    *   `sent_at`: Date (Default: now)
    *   `status`: String (Enum: 'new', 'read', 'replied') // Or manage via chat status

*   **`messages`** (Used for the internal chat system, potentially a different structure optimized for chat)
    *   `_id`: ObjectId
    *   `conversation_id`: ObjectId (Indexed) // Can represent the inquiry/listing chat thread
    *   `sender_id`: ObjectId (Ref: `users`, Indexed)
    *   `recipient_id`: ObjectId (Ref: `users`, Indexed) // Or can be derived from conversation_id
    *   `listing_id`: ObjectId (Optional, Indexed) // Link message to a specific listing context
    *   `content`: String
    *   `sent_at`: Date (Default: now, Indexed)
    *   `read_at`: Date (Optional)
    *   `status`: String (Enum: 'sent', 'delivered', 'read')

*   **`conversations`** (To manage chat threads easily)
    *   `_id`: ObjectId
    *   `participants`: [ObjectId] (Refs: `users`, Indexed for querying by user)
    *   `listing_id`: ObjectId (Ref: `vehicles`, `businesses`, `classifieds`, Optional, Indexed) // Link conversation to a listing
    *   `listing_type`: String (Enum: 'vehicle', 'business', 'classified', Optional)
    *   `last_message_at`: Date (Indexed)
    *   `created_at`: Date

*   **`subscription_plans`**
    *   `_id`: ObjectId
    *   `name`: String (e.g., 'Basic Business', 'Premium Business', 'Featured Vehicle')
    *   `slug`: String (Unique)
    *   `description`: String
    *   `price`: Number
    *   `duration_days`: Number
    *   `features`: { max_listings: Number, can_add_videos: Boolean, is_featured: Boolean, is_promoted: Boolean, kyc_required: Boolean, support_level: String, listing_types: [String] } // Define plan benefits
    *   `is_active`: Boolean (Default: true)

*   **`payments`**
    *   `_id`: ObjectId
    *   `user_id`: ObjectId (Ref: `users`, Indexed)
    *   `entity_id`: ObjectId (Ref: `businesses`, `vehicles`, `promotions`, Indexed) // What the payment is for
    *   `entity_type`: String (Enum: 'subscription', 'listing_promotion')
    *   `plan_id`: ObjectId (Ref: `subscription_plans`, Optional)
    *   `amount`: Number
    *   `currency`: String (e.g., 'INR')
    *   `gateway`: String (e.g., 'razorpay')
    *   `gateway_order_id`: String (Generated by gateway, Indexed)
    *   `gateway_payment_id`: String (Generated by gateway after success)
    *   `gateway_signature`: String (For verification)
    *   `status`: String (Enum: 'created', 'pending', 'completed', 'failed')
    *   `created_at`: Date (Default: now)
    *   `completed_at`: Date (Optional)

*   **`promotions`** (For tracking paid ad boosts)
    *   `_id`: ObjectId
    *   `listing_id`: ObjectId (Ref: `vehicles`, `classifieds`, Indexed)
    *   `listing_type`: String (Enum: 'vehicle', 'classified')
    *   `user_id`: ObjectId (Ref: `users`)
    *   `payment_id`: ObjectId (Ref: `payments`)
    *   `type`: String (Enum: 'featured', 'boost')
    *   `start_date`: Date
    *   `end_date`: Date (Indexed for expiry checks)
    *   `is_active`: Boolean

*   **`blogs`**
    *   `_id`: ObjectId
    *   `title`: String (Indexed)
    *   `slug`: String (Unique, for SEO-friendly URLs)
    *   `author_id`: ObjectId (Ref: `users`, Indexed)
    *   `content`: String (HTML/Markdown)
    *   `excerpt`: String
    *   `featured_image`: String (Optional file path/URL)
    *   `status`: String (Enum: 'draft', 'published', 'archived')
    *   `published_at`: Date (Optional, Indexed)
    *   `created_at`: Date (Default: now)
    *   `updated_at`: Date (Default: now)
    *   `seo`: { title: String, description: String, keywords: String }

*   **`banners`** (For managing ad banners)
    *   `_id`: ObjectId
    *   `name`: String
    *   `image_url`: String // File path/URL
    *   `link_url`: String (Optional, where the banner clicks to)
    *   `location`: String (Enum: 'homepage_top', 'homepage_middle', 'login_page', etc.)
    *   `start_date`: Date
    *   `end_date`: Date (Indexed)
    *   `is_active`: Boolean
    *   `clicks_count`: Number (Default: 0)
    *   `views_count`: Number (Default: 0)

## 3. API Design (Endpoints & Request/Response)

Using `/api/v1/` prefix for versioning.

**Authentication (`/api/v1/auth`)**

*   `POST /register`
    *   Req Body: `{ name, email, password, mobile(optional), role('user'/'business') }`
    *   Res: `{ success: true, message: 'User registered', userId: '...' }` or `{ success: false, error: '...' }`
*   `POST /login`
    *   Req Body: `{ email, password }`
    *   Res: `{ success: true, token: '...', user: { _id, name, email, role, ... } }` or `{ success: false, error: 'Invalid credentials' }`
*   `POST /login/social` (Google/Facebook)
    *   Req Body: `{ token_id, role }` (ID token from OAuth provider)
    *   Res: `{ success: true, token: '...', user: { ... } }` or `{ success: false, error: '...' }`
*   `POST /logout` (Requires Auth)
    *   Req Body: None
    *   Res: `{ success: true, message: 'Logged out' }`
*   `GET /me` (Requires Auth)
    *   Req Body: None
    *   Res: `{ success: true, user: { ...user data excluding password... } }`
*   `POST /request-password-reset`
    *   Req Body: `{ email }`
    *   Res: `{ success: true, message: 'Password reset email sent' }`
*   `POST /reset-password`
    *   Req Body: `{ token, newPassword }` (Token sent via email)
    *   Res: `{ success: true, message: 'Password reset successful' }`
*   `POST /request-mobile-otp`
    *   Req Body: `{ mobile }`
    *   Res: `{ success: true, message: 'OTP sent' }`
*   `POST /verify-mobile-otp`
    *   Req Body: `{ mobile, otp }`
    *   Res: `{ success: true, message: 'Mobile verified' }` (Maybe update user profile)

**Master Data (`/api/v1/master`)**

*   `GET /types`
    *   Req Query: `?type=vehicle_type` or `?types=vehicle_type,used_for`
    *   Res: `{ success: true, data: { vehicle_type: [...], used_for: [...] } }`
*   `GET /brands`
    *   Res: `{ success: true, data: [...] }`
*   `GET /models/:brandId`
    *   Res: `{ success: true, data: [...] }`
*   `GET /locations/states`
    *   Res: `{ success: true, data: [...] }`
*   `GET /locations/cities/:stateId`
    *   Res: `{ success: true, data: [...] }`

**Listings (Generic Search/Filter - `/api/v1/listings`)**

*   `GET /` (Requires Auth, Public) - Search all types
    *   Req Query: `?q=keyword`, `?type=vehicle,business`, `?location=lat,lng&radius=km`, `?sort=date,price`, `?page=1&limit=10`, `?minPrice=1000`, `?maxPrice=5000`, `?features=AC,Stereo` etc. (Complex filtering)
    *   Res: `{ success: true, data: [{ type: 'vehicle', ...listing }, { type: 'business', ...listing }], total: 100 }`

**Vehicles (`/api/v1/vehicles`)**

*   `POST /` (Requires Auth) - Create Vehicle Listing
    *   Req Body: `{ type, used_for, brand, model, ...listing data... }`, `files: [...]` (multipart/form-data)
    *   Res: `{ success: true, message: 'Listing created', listingId: '...' }`
*   `GET /` (Public) - Get Vehicle Listings (Search/Filter specific)
    *   Req Query: `?type=car`, `?brand=toyota`, `?transmission=manual`, `?minYear=2010`, `?maxKm=50000`, etc. (Vehicle specific filters + generic)
    *   Res: `{ success: true, data: [...vehicle listings], total: 50 }`
*   `GET /:id` (Public) - Get Vehicle Detail
    *   Req Params: `id`
    *   Res: `{ success: true, data: { ...vehicle data... } }` (Includes incrementing view count)
*   `PUT /:id` (Requires Auth, Owner/Admin) - Update Vehicle Listing
    *   Req Params: `id`
    *   Req Body: `{ ...updated listing data... }`, `files: [...]`
    *   Res: `{ success: true, message: 'Listing updated' }`
*   `DELETE /:id` (Requires Auth, Owner/Admin) - Delete Vehicle Listing
    *   Req Params: `id`
    *   Res: `{ success: true, message: 'Listing deleted' }`
*   `POST /:id/inquiry` (Requires Auth) - Send Inquiry for Vehicle
    *   Req Params: `id`
    *   Req Body: `{ message }`
    *   Res: `{ success: true, message: 'Inquiry sent' }`

**Businesses (`/api/v1/businesses`)**

*   `POST /` (Requires Auth, role='business') - Create Business Listing
    *   Req Body: `{ name, logo(file), description, services_offered, ... }`, `files: [...]` (multipart/form-data)
    *   Res: `{ success: true, message: 'Business listing created', businessId: '...' }`
*   `GET /` (Public) - Get Business Listings (Search/Filter specific)
    *   Req Query: `?q=keyword`, `?service=car_wrapping`, `?location=...`, `?rating=4`, `?isVerified=true` etc. (Business specific filters + generic)
    *   Res: `{ success: true, data: [...business listings], total: 30 }`
*   `GET /:id` (Public) - Get Business Detail
    *   Req Params: `id`
    *   Res: `{ success: true, data: { ...business data including pricing, locations, reviews summary... } }` (Includes incrementing view count)
*   `PUT /:id` (Requires Auth, Owner/Admin) - Update Business Listing
    *   Req Params: `id`
    *   Req Body: `{ ...updated data... }`, `files: [...]`
    *   Res: `{ success: true, message: 'Business listing updated' }`
*   `DELETE /:id` (Requires Auth, Owner/Admin) - Delete Business Listing
    *   Req Params: `id`
    *   Res: `{ success: true, message: 'Business listing deleted' }`
*   `POST /:id/inquiry` (Requires Auth) - Send Inquiry for Business
    *   Req Params: `id`
    *   Req Body: `{ message }`
    *   Res: `{ success: true, message: 'Inquiry sent' }`

**Events (`/api/v1/events`)**

*   `POST /` (Requires Auth) - Create Event Listing
    *   Req Body: `{ title, description, category, start_date, ... }`, `files: [...]`
    *   Res: `{ success: true, message: 'Event created', eventId: '...' }`
*   `GET /` (Public) - Get Event Listings (Search/Filter)
    *   Req Query: `?q=keyword`, `?category=rally`, `?location=...`, `?startDate=2024-07-01`
    *   Res: `{ success: true, data: [...event listings], total: 15 }`
*   `GET /:id` (Public) - Get Event Detail
    *   Req Params: `id`
    *   Res: `{ success: true, data: { ...event data... } }` (Includes incrementing view count)
*   `PUT /:id` (Requires Auth, Owner/Admin) - Update Event Listing
    *   Req Params: `id`
    *   Req Body: `{ ...updated data... }`, `files: [...]`
    *   Res: `{ success: true, message: 'Event updated' }`
*   `DELETE /:id` (Requires Auth, Owner/Admin) - Delete Event Listing
    *   Req Params: `id`
    *   Res: `{ success: true, message: 'Event deleted' }`

**Classifieds (`/api/v1/classifieds`)**

*   `POST /` (Requires Auth) - Create Classified Listing
    *   Req Body: `{ title, description, category, price, ... }`, `files: [...]`
    *   Res: `{ success: true, message: 'Classified created', classifiedId: '...' }`
*   `GET /` (Public) - Get Classified Listings (Search/Filter)
    *   Req Query: `?q=keyword`, `?category=material`, `?minPrice=...`, `?location=...`
    *   Res: `{ success: true, data: [...classified listings], total: 200 }`
*   `GET /:id` (Public) - Get Classified Detail
    *   Req Params: `id`
    *   Res: `{ success: true, data: { ...classified data... } }` (Includes incrementing view count)
*   `PUT /:id` (Requires Auth, Owner/Admin) - Update Classified Listing
    *   Req Params: `id`
    *   Req Body: `{ ...updated data... }`, `files: [...]`
    *   Res: `{ success: true, message: 'Classified updated' }`
*   `DELETE /:id` (Requires Auth, Owner/Admin) - Delete Classified Listing
    *   Req Params: `id`
    *   Res: `{ success: true, message: 'Classified deleted' }`

**Reviews (`/api/v1/reviews`)**

*   `POST /` (Requires Auth) - Add Review
    *   Req Body: `{ listing_id, listing_type, rating, comment }`
    *   Res: `{ success: true, message: 'Review submitted', reviewId: '...' }` (Initially pending moderation)
*   `GET /:listingType/:listingId` (Public) - Get Reviews for a Listing
    *   Req Params: `listingType`, `listingId`
    *   Req Query: `?page=1&limit=10`
    *   Res: `{ success: true, data: [...approved reviews], total: 10 }`
*   `PUT /:id` (Requires Auth, Owner/Admin) - Update Review (Owner can edit before approval, Admin can edit any)
    *   Req Params: `id`
    *   Req Body: `{ rating, comment }`
    *   Res: `{ success: true, message: 'Review updated' }`
*   `DELETE /:id` (Requires Auth, Owner/Admin) - Delete Review
    *   Req Params: `id`
    *   Res: `{ success: true, message: 'Review deleted' }`

**Inquiries (`/api/v1/inquiries`)**

*   `GET /my` (Requires Auth) - Get Inquiries related to current user (sent or received)
    *   Req Query: `?role=sent` or `?role=received`, `?page=1&limit=10`
    *   Res: `{ success: true, data: [...inquiries], total: 20 }`
*   `GET /:id` (Requires Auth, Owner/Admin) - Get specific Inquiry detail
    *   Req Params: `id`
    *   Res: `{ success: true, data: { ...inquiry data... } }`
*   `PUT /:id/read` (Requires Auth, Receiver) - Mark Inquiry as Read
    *   Req Params: `id`
    *   Res: `{ success: true, message: 'Inquiry marked as read' }`

**Messaging (`/api/v1/messages`) - Complementary to WebSocket**

*   `GET /conversations` (Requires Auth) - Get user's conversations
    *   Res: `{ success: true, data: [...conversations including last message snippet...] }`
*   `GET /conversations/:conversationId/messages` (Requires Auth) - Get messages in a conversation
    *   Req Query: `?page=1&limit=20` (for loading older messages)
    *   Res: `{ success: true, data: [...messages], total: 50 }`
*   `POST /conversations/:conversationId/messages` (Requires Auth) - Send a message (Alternative to WebSocket for initial message or fallback)
    *   Req Body: `{ content }`
    *   Res: `{ success: true, message: 'Message sent', messageId: '...' }`

**User Dashboard (`/api/v1/dashboard`)**

*   `GET /my-listings/:type` (Requires Auth) - Get user's listings by type (vehicle, business, event, classified)
    *   Req Params: `type`
    *   Res: `{ success: true, data: [...listings] }`
*   `GET /saved-listings` (Requires Auth) - Get user's saved listings
    *   Res: `{ success: true, data: [...listings] }`
*   `PUT /profile` (Requires Auth) - Update user profile
    *   Req Body: `{ name, address, contact_details, ... }`
    *   Res: `{ success: true, message: 'Profile updated' }`

**Payments (`/api/v1/payments`)**

*   `GET /plans` (Public) - Get available subscription/promotion plans
    *   Res: `{ success: true, data: [...plans] }`
*   `POST /checkout` (Requires Auth) - Initiate a payment (for a plan or promotion)
    *   Req Body: `{ plan_id, listing_id(optional), listing_type(optional) }`
    *   Res: `{ success: true, order: { id: 'razorpay_order_id', amount: ..., currency: ... } }`
*   `POST /webhook/razorpay` (Public - Called by Razorpay) - Handle payment success/failure notification
    *   Req Body: Raw payload from Razorpay
    *   Res: Status 200 (if verified and processed)
*   `GET /history` (Requires Auth) - Get user's payment history
    *   Res: `{ success: true, data: [...payments] }`

**Admin Panel (`/api/v1/admin`) - Requires Auth & Admin Role**

*   `GET /users` - List users, filter by role/status
*   `GET /users/:id` - Get user details
*   `PUT /users/:id` - Update user details (role, status)
*   `DELETE /users/:id` - Delete user
*   `GET /listings/:type` - List listings by type, filter by status (pending_approval, active, rejected)
*   `GET /listings/:type/:id` - Get listing details
*   `PUT /listings/:type/:id` - Update listing details, change status (approve/reject)
*   `DELETE /listings/:type/:id` - Delete listing
*   `GET /reviews` - List reviews, filter by status
*   `PUT /reviews/:id/status` - Approve/Reject review
*   `DELETE /reviews/:id` - Delete review
*   `GET /payments` - List payments, filter by status, user, entity
*   `GET /master-data` - List all master data types
*   `POST /master-data/:type` - Add new value to master data type
*   `PUT /master-data/:type/:valueId` - Update master data value
*   `DELETE /master-data/:type/:valueId` - Delete master data value
*   `GET /analytics/summary` - Get dashboard analytics (counts, revenue summary)
*   `GET /banners` - List banners
*   `POST /banners` - Create banner (upload image)
*   `PUT /banners/:id` - Update banner
*   `DELETE /banners/:id` - Delete banner
*   `GET /blogs` - List blog posts
*   `POST /blogs` - Create blog post
*   `PUT /blogs/:id` - Update blog post
*   `DELETE /blogs/:id` - Delete blog post

## 4. Backend Module Breakdown (Node.js/Express)

Standard MVC structure with services.

*   **`src/`**
    *   `app.js`: Express app setup, middleware (body-parser, cors, error handler), connect to DB.
    *   `server.js`: Start the HTTP server, connect to Socket.io.
    *   `config/`: Configuration files (database URLs, JWT secret, API keys, Redis config).
    *   `middlewares/`:
        *   `authMiddleware.js`: Verify JWT token, attach user to request (`req.user`).
        *   `adminMiddleware.js`: Check if `req.user` has 'admin' role.
        *   `ownerMiddleware.js`: Check if `req.user` is the owner of the requested resource.
        *   `errorHandler.js`: Centralized error handling.
        *   `uploadMiddleware.js`: Multer configuration and upload handling.
        *   `logger.js`: Logging setup (e.g., Winston).
        *   `rateLimiter.js`: Express rate limiting.
    *   `models/`: Mongoose Schemas (`User.js`, `Vehicle.js`, `Business.js`, `Review.js`, etc.).
    *   `services/`: Business logic layer. Orchestrates database calls.
        *   `authService.js`: User registration, login, password reset.
        *   `userService.js`: User profile management, saved listings.
        *   `listingService.js`: Generic service for creating, updating, deleting listings (can delegate to specific services). Handles search and filtering logic.
        *   `vehicleService.js`: Specific logic for vehicles.
        *   `businessService.js`: Specific logic for businesses, calculating rating.
        *   `eventService.js`: Specific logic for events.
        *   `classifiedService.js`: Specific logic for classifieds.
        *   `reviewService.js`: Review creation, moderation, calculating average.
        *   `inquiryService.js`: Inquiry handling.
        *   `messageService.js`: Database operations for messages/conversations.
        *   `paymentService.js`: Interactions with Payment Gateway SDK, handling webhooks.
        *   `adminService.js`: Admin-specific business logic (approvals, analytics).
        *   `masterDataService.js`: Fetching master data.
        *   `fileUploadService.js`: Uploading files to cloud storage.
        *   `emailService.js`: Sending emails.
        *   `smsService.js`: Sending SMS.
    *   `controllers/`: Handle incoming requests, call services, format responses.
        *   `authController.js`
        *   `userController.js`
        *   `listingController.js` (Generic search)
        *   `vehicleController.js` (Specific endpoints)
        *   `businessController.js`
        *   `eventController.js`
        *   `classifiedController.js`
        *   `reviewController.js`
        *   `inquiryController.js`
        *   `messageController.js` (For REST endpoints)
        *   `paymentController.js`
        *   `adminController.js`
        *   `masterDataController.js`
        *   `bannerController.js`
        *   `blogController.js`
    *   `routes/`: Define API routes using Express Router, apply middleware.
        *   `authRoutes.js`
        *   `userRoutes.js`
        *   `listingRoutes.js`
        *   `vehicleRoutes.js`
        *   `businessRoutes.js`
        *   `eventRoutes.js`
        *   `classifiedRoutes.js`
        *   `reviewRoutes.js`
        *   `inquiryRoutes.js`
        *   `messageRoutes.js`
        *   `paymentRoutes.js`
        *   `adminRoutes.js`
        *   `masterDataRoutes.js`
        *   `bannerRoutes.js`
        *   `blogRoutes.js`
    *   `utils/`: Helper functions (e.g., password hashing, JWT signing, data formatting).
    *   `socket/`: Socket.io event handlers.
        *   `socketServer.js`: Initialize Socket.io server, handle connections.
        *   `chatHandler.js`: Logic for chat events (`join`, `message`).
        *   `notificationHandler.js`: Logic for notifications (e.g., new inquiry).
    *   `queue/` (Optional): If using Redis queues for background jobs.
        *   `queue.js`: Queue definition (e.g., BullMQ setup).
        *   `workers/`: Worker functions to process jobs (e.g., send email, process image, check listing expiry).

## 5. Frontend Component Breakdown (React)

Using Functional Components and Hooks. State management with React Context or Redux/Zustand. Routing with React Router DOM.

*   **`src/`**
    *   `App.js`: Root component, sets up React Router.
    *   `index.js`: Entry point, renders `App`, wraps with context providers (AuthContext, SocketContext, etc.).
    *   `components/`: Reusable UI elements.
        *   `Layout/`: Header, Footer, Navigation.
        *   `Forms/`: InputField, Button, Dropdown, FileUploader, MultiStepForm.
        *   `Listings/`: ListingCard (Generic), VehicleCard, BusinessCard, EventCard, ClassifiedCard.
        *   `UI/`: Carousel, Modal, Spinner, Alert, Pagination, MapComponent.
        *   `Chat/`: ChatWindow, ConversationList, MessageInput.
        *   `Reviews/`: ReviewList, ReviewForm, StarRating.
        *   `Admin/`: DataTable, AdminSidebar.
        *   `Ads/`: BannerComponent.
    *   `pages/`: Components representing main views/pages.
        *   `HomePage.js`
        *   `Auth/`: LoginPage.js, RegisterPage.js, ForgotPasswordPage.js, MobileVerificationPage.js.
        *   `Listings/`: ListingListPage.js (Generic search results), VehicleListPage.js, BusinessListPage.js, EventListPage.js, ClassifiedListPage.js.
        *   `Listings/`: ListingDetailPage.js (Generic wrapper), VehicleDetailPage.js, BusinessDetailPage.js, EventDetailPage.js, ClassifiedDetailPage.js.
        *   `Dashboard/`: DashboardLayout.js, MyListingsPage.js, SavedListingsPage.js, ProfileSettingsPage.js.
        *   `ListingForms/`: AddVehiclePage.js, AddBusinessPage.js, AddEventPage.js, AddClassifiedPage.js (Multi-step forms).
        *   `Admin/`: AdminDashboardPage.js, AdminUsersPage.js, AdminListingsPage.js, AdminReviewsPage.js, AdminMasterDataPage.js, AdminPaymentsPage.js, AdminBannersPage.js, AdminBlogsPage.js.
        *   `Blog/`: BlogListPage.js, BlogDetailPage.js.
        *   `Payments/`: CheckoutPage.js, PaymentHistoryPage.js.
        *   `AboutPage.js`, `ContactPage.js`, etc.
    *   `context/`: React Context providers for global state.
        *   `AuthContext.js`: Manages user authentication state, JWT token.
        *   `SocketContext.js`: Manages Socket.io connection and state.
        *   `NotificationContext.js`: Handles displaying notifications (e.g., new message).
        *   `AppConfigContext.js`: Stores frequently needed config/master data.
    *   `hooks/`: Custom React hooks (e.g., `useFetch`, `useForm`, `useAuth`, `useSocket`).
    *   `api/`: Service to make API calls using `fetch` or `axios`.
        *   `apiClient.js`: Axios instance with interceptors for adding Auth token, handling errors.
        *   `authApi.js`, `listingApi.js`, `userApi.js`, etc.
    *   `socket/`: Socket.io client setup and event handling.
        *   `socket.js`: Socket.io client instance, connection logic.
        *   `socketEvents.js`: Register event listeners (new message, new inquiry notification).
    *   `utils/`: Helper functions (date formatting, data transformation, validation).
    *   `constants/`: Application constants (API endpoints, roles, listing statuses).
    *   `assets/`: Images, fonts, CSS.
    *   `styles/`: CSS files or styled components.

## 6. Key Technical Implementations

*   **Authentication & Authorization (JWT, Redis):**
    *   **Backend:**
        *   User login/registration: Validate credentials, generate JWT token signing with a secret key. Token payload includes `userId` and `role`.
        *   Store user session data (like login time, token validity status) in Redis using the JWT ID or `userId` as key, set expiry. This allows token invalidation without hitting the DB for every request.
        *   `authMiddleware`: Extracts token from `Authorization: Bearer <token>` header, verifies JWT signature, checks Redis for session validity (optional but good for fast invalidation), attaches `req.user = { userId, role }`.
        *   `adminMiddleware`, `ownerMiddleware`: Apply *after* `authMiddleware` to check `req.user.role` or compare `req.user.userId` with resource owner ID.
    *   **Frontend:**
        *   On successful login, store JWT token in `localStorage` or `sessionStorage`.
        *   Use Axios interceptor to automatically add `Authorization: Bearer <token>` header to all outgoing API requests (except auth login/register).
        *   Use `AuthContext` to manage user login state and role throughout the app. Protect routes using React Router based on authentication state and role.

*   **File Uploads (Multer, Cloud Storage):**
    *   **Backend:**
        *   Use Multer as middleware on relevant routes (`POST /api/v1/vehicles`, `POST /api/v1/businesses`, etc.).
        *   Configure Multer to handle `multipart/form-data`. Instead of disk storage, use a storage engine that uploads directly to cloud storage or upload manually within the route handler after Multer processes the files into memory/temp storage.
        *   Use a cloud storage SDK (e.g., AWS SDK for S3) in `fileUploadService` to upload processed files.
        *   Store the resulting URLs (from cloud storage) in the MongoDB listing documents.
        *   For file types (interior, exterior, etc. for vehicles), structure the Multer fields or handle the categorization in the service logic.
    *   **Frontend:**
        *   Use HTML `<input type="file">` or a library like `react-dropzone` to handle file selection.
        *   Use `FormData` object to package files and other form data for `multipart/form-data` requests.
        *   Send `FormData` using Axios/fetch to the backend API.

*   **Search & Filtering:**
    *   **Backend:**
        *   Implement a flexible search service (`listingService`).
        *   Accept diverse query parameters from the frontend.
        *   Construct dynamic MongoDB queries using Mongoose based on parameters:
            *   Text Search: Use MongoDB's `$text` index or Atlas Search for keyword search.
            *   Filters: Use `$match` stage in aggregation pipeline or query object for exact matches, range queries (`$gte`, `$lte`), array matches (`$in`, `$all`).
            *   Geo-Spatial: Use `$geoWithin` or `$near` for location-based radius search (requires 2dsphere index on `location`).
            *   Sorting (`$sort`), Pagination (`$skip`, `$limit`).
            *   Joining/Populating (`$lookup` or Mongoose `.populate()`) to include related data (e.g., owner name, business reviews summary).
    *   **Frontend:**
        *   Design intuitive UI elements for search (text input) and filters (dropdowns, checkboxes, sliders, date pickers, map integration for location).
        *   Fetch master data (brands, types, locations, etc.) to populate filter options.
        *   Build a state object representing current filter selections.
        *   Update URL query parameters using `history.push` or `useSearchParams` hook to reflect filters (for sharable URLs).
        *   Debounce search input to avoid excessive API calls.
        *   Fetch data using the API service based on the filter state and pagination/sorting parameters. Display results.

*   **Real-time Messaging (Socket.io, Redis):**
    *   **Backend:**
        *   Integrate `socket.io` with the Express server.
        *   Use `socket.io-redis` adapter if running multiple Node.js instances to scale (uses Redis Pub/Sub).
        *   Upon user login/authentication via HTTP, establish a WebSocket connection. Associate the socket connection with the `userId`.
        *   Implement event handlers:
            *   `connection`: Handle new connections.
            *   `disconnect`: Handle disconnections.
            *   `join_conversation`: User joins a specific chat conversation room (e.g., identified by `conversationId`).
            *   `send_message`: User sends a message. Validate message, save to MongoDB (`messages` collection), emit `new_message` event to other participants in the conversation room via `socket.to(conversationId).emit(...)`.
            *   `mark_as_read`: User reads messages. Update `read_at` in MongoDB. Emit event to sender.
        *   Use Redis Pub/Sub if scaling horizontally. A message received on one instance is published to a Redis channel, and other instances subscribed to that channel receive it and can then emit via their connected sockets.
    *   **Frontend:**
        *   Establish Socket.io connection after user is authenticated.
        *   Use `SocketContext` to manage the socket instance and connection status.
        *   Join relevant conversation rooms upon opening a chat window or viewing a listing they have an inquiry on.
        *   Emit `send_message` event to the backend when user sends a message.
        *   Listen for `new_message` events and update the chat UI state.
        *   Listen for `notification` events (e.g., new inquiry on a listing) and display UI notifications.

*   **Caching Strategy (Redis):**
    *   **Session Store:** Use `connect-redis` or similar library to store Express sessions in Redis. This is scalable for multiple servers.
    *   **API Response Caching:** Cache responses for frequently accessed data that doesn't change often or can be slightly stale:
        *   Master data (`/api/v1/master/*`)
        *   Homepage featured/trending listings (update periodically via a background job)
        *   Popular search results/filters.
        *   Implement caching middleware or wrap service calls. Use Redis `GET`, `SET`, `DEL`, `EX` (expiry). Invalidate cache when underlying data changes (e.g., listing updated, master data changed).
    *   **Object Caching:** Cache specific objects fetched from MongoDB by ID (e.g., a specific user profile or business listing) if accessed frequently, before hitting MongoDB.

*   **Payment Gateway Integration (Razorpay):**
    *   **Backend:**
        *   Use Razorpay Node.js SDK.
        *   `/api/v1/payments/checkout` endpoint: Receives request for a payment (plan/promotion), creates a Razorpay Order using the SDK, saves minimal payment record (`status: 'created'`) in your DB, returns Order ID and details to frontend.
        *   `/api/v1/webhook/razorpay` endpoint: Needs to be public. Configure Razorpay to send webhook notifications here.
            *   Verify the webhook signature using Razorpay secret.
            *   Handle `payment.captured` event: Look up your payment record using the `gateway_order_id`, update status to `completed`, process the purchase (activate subscription, mark listing as promoted, etc.).
            *   Handle `payment.failed` event: Update your payment record status to `failed`.
    *   **Frontend:**
        *   User selects a plan/promotion and initiates checkout.
        *   Call `/api/v1/payments/checkout` to get Razorpay Order details.
        *   Use Razorpay's official frontend library (Razorpay Checkout) to open the payment popup. Pass the Order ID and other details.
        *   Razorpay Checkout handles card/UPI/etc. flow.
        *   On successful payment in the popup, Razorpay Checkout provides payment details. Send these details (`razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature`) to your backend (`/api/v1/payments/verify`) for final server-side verification and processing (although webhook is the primary method, this adds robustness).

*   **Admin Functionality:**
    *   **Backend:**
        *   Dedicated routes (`/api/v1/admin/*`) protected by `authMiddleware` and `adminMiddleware`.
        *   Admin service/controllers with methods for managing users, listings, reviews, etc.
        *   Logic for approving/rejecting content (updating `status` field in DB).
        *   Fetching data for admin tables (potentially using pagination/sorting/filtering on backend).
        *   Endpoints for analytics data aggregation.
        *   Endpoints for managing banners, blog posts, master data.
    *   **Frontend:**
        *   Dedicated Admin section/dashboard component, only rendered if the logged-in user has the 'admin' role (checked via `AuthContext`).
        *   UI components like data tables (e.g., using libraries like `react-table`) to display lists of users, listings, etc.
        *   Forms for editing entities or changing statuses.
        *   Visualizations for analytics data.

*   **Background Tasks (Redis Queues - Optional but recommended):**
    *   Use a library like BullMQ (built on Redis) for managing background jobs.
    *   **Jobs:**
        *   Processing listing expiry (`CheckListingExpiryJob`).
        *   Sending scheduled emails (e.g., "Your listing expires soon").
        *   Recalculating business ratings periodically.
        *   Processing uploaded images (resizing, generating thumbnails).
        *   Sending bulk notifications.
    *   **Implementation:** Create job producers (e.g., when a listing is created/updated, add an expiry job to the queue) and worker processes (separate Node.js scripts or within the main app) that consume jobs from the queue and execute the logic.

## 7. Error Handling

*   **Backend:**
    *   Implement a centralized error handling middleware (`errorHandler.js`).
    *   Custom error classes for specific types of errors (e.g., `AuthError`, `NotFoundError`, `ValidationError`, `ForbiddenError`).
    *   Controllers/Services throw these custom errors.
    *   The error middleware catches these errors and sends a standardized JSON response: `{ success: false, error: { message: '...', code: '...' } }` with appropriate HTTP status codes (400, 401, 403, 404, 500).
    *   Log detailed error information on the server side (using `logger.js`).
*   **Frontend:**
    *   Use `try...catch` blocks when making API calls or Axios interceptors to catch errors.
    *   API service (`apiClient.js`) handles parsing the standardized error response.
    *   Display user-friendly error messages to the user (e.g., using a notification/alert component managed by `NotificationContext`).

## 8. Security Considerations

*   **Input Validation & Sanitization:** Validate all incoming data on the backend (using libraries like Joi or Express-Validator) to prevent injection attacks and ensure data integrity. Sanitize user-generated HTML content if allowing rich text.
*   **Authentication & Authorization:** As detailed above (JWT, role-based access control). Ensure server-side checks are the primary security measure, not just frontend UI hiding.
*   **Password Security:** Hash passwords using strong, slow hashing algorithms (e.g., bcrypt) before storing them.
*   **Rate Limiting:** Protect against brute-force attacks and DoS by limiting requests per IP address using `express-rate-limit`.
*   **CORS:** Configure CORS middleware appropriately to allow requests only from your frontend domain.
*   **HTTPS:** Enforce HTTPS on both frontend and backend (essential for transmitting sensitive data like passwords, tokens, payment info).
*   **File Upload Security:** Validate file types and sizes. Store files outside the webroot or in a dedicated cloud storage bucket. Use random file names to prevent directory traversal. Scan for viruses (can be a background job).
*   **Preventing XSS:** Sanitize user-generated content before displaying it in the frontend. React helps by default, but be careful with `dangerouslySetInnerHTML`.
*   **Preventing CSRF:** For state-changing requests (POST, PUT, DELETE), consider using CSRF tokens (library like `csurf`).
*   **Protecting Sensitive Data:** Encrypt sensitive information at rest (e.g., database encryption features) and in transit (HTTPS). Do not store plain text passwords, API keys in code or publicly accessible files. Use environment variables.
*   **Review Moderation:** Implement a flow to review user-submitted reviews before publishing them to prevent spam or malicious content.
*   **Spam Detection:** Implement measures for detecting fake accounts or spam listings (e.g., honeypots, checking IP patterns, linking mobile verification).

## 9. Deployment Considerations

*   **Backend:** Deploy Node.js applications using process managers like PM2 or containerization (Docker). Use a hosting provider like AWS, DigitalOcean, Heroku, Vercel (for serverless functions, but might be complex for this type of app), etc.
*   **Frontend:** Deploy React app as static files served by a web server (Nginx, Apache) or a hosting service optimized for SPAs (Netlify, Vercel, AWS S3 + CloudFront). Build the app for production (`npm run build`).
*   **Database:** Use a managed MongoDB service like MongoDB Atlas for production due to ease of scaling, backups, and maintenance.
*   **Redis:** Use a managed Redis service (e.g., AWS ElastiCache, RedisCloud) or set up a dedicated Redis server.
*   **File Storage:** Use a cloud storage service (AWS S3, GCS) for persistent, scalable, and reliable file storage.
*   **Environment Variables:** Use environment variables (`.env`) to manage configuration secrets (database URLs, API keys, JWT secret, cloud storage credentials) and separate configuration between development, staging, and production.
*   **Logging & Monitoring:** Set up centralized logging (e.g., ELK stack, Datadog, CloudWatch Logs) and application performance monitoring (APM) to track errors, performance bottlenecks, and server health.
*   **CI/CD:** Implement Continuous Integration and Continuous Deployment pipelines to automate testing and deployment processes.

---

This LLD provides a comprehensive technical blueprint for building your platform using the specified technologies. It outlines the database structure, API interactions, module responsibilities, and key implementation details for core features, technical aspects, and security. Remember that this is a starting point, and further refinement and detailed task breakdowns will be needed during the actual development phase.