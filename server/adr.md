# Architectural Decision Record (ADR)

This document records the major technical decisions made during the development of the project, including the context, options considered, and the final rationale.

---

## 1. Choice of Database: MongoDB Atlas vs. Local JSON Files

**Context:** The application requires a reliable way to store and manage data for items, users, and messages. Initially, local JSON files were used for rapid prototyping.

**Options Considered:**
* Local JSON file storage (using the Node.js `fs` module).
* **MongoDB Atlas (NoSQL Cloud Database).**

**Decision:** I chose **MongoDB Atlas**.

**Tradeoffs:**
* **Pros:** Provides data persistence, built-in validation, and professional-grade scalability. It allows the application to be accessible from any environment (local or cloud) without losing data between deployments.
* **Cons:** Requires active network access and specific configuration for IP whitelisting and connection strings.

---

## 2. Implementation of CORS for Cross-Origin Security

**Context:** To allow the frontend to communicate with the backend API—especially when they might be hosted on different ports or domains—a mechanism to handle Cross-Origin Resource Sharing was required.

**Options Considered:**
* Default Express settings (which block cross-origin requests).
* **Implementing CORS middleware.**

**Decision:** I chose to implement **CORS**.

**Tradeoffs:**
* **Pros:** Essential for modern web security. It allows the backend to explicitly permit requests from the frontend, ensuring smooth communication while protecting the API from unauthorized cross-site requests.
* **Cons:** Improper configuration can lead to "CORS errors" during development if the frontend origin is not correctly specified.

---

## 3. Using Environment Variables (.env) for Configuration

**Context:** The application handles sensitive data, including the `MONGODB_URI` connection string and server configuration like the `PORT`.

**Options Considered:**
* Hardcoding credentials directly in the source code.
* **Using a `.env` file via the `dotenv` package.**

**Decision:** I chose to use **Environment Variables**.

**Tradeoffs:**
* **Pros:** This is a critical security best practice. It prevents sensitive database credentials from being leaked into version control (GitHub). It also makes the application "portable," allowing it to run in different environments (Development, Testing, Production) without code changes.
* **Cons:** None. This is the industry standard for secure application configuration.

---

## Summary of Decisions

| Decision | Choice | Key Rationale |
| :--- | :--- | :--- |
| **Database** | MongoDB Atlas | Data integrity and professional cloud storage. |
| **Security** | CORS Middleware | Controlled access and cross-origin compatibility. |
| **Configuration** | Dotenv (.env) | Secure management of sensitive credentials. |