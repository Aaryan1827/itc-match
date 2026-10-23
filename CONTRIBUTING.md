# Contributing

Thank you for your interest in contributing to ITC-Match!

## Prerequisites

- **Node.js 20+** and **npm** (or Bun, see unfig.toml)

## Getting Started

`ash
# 1. Install dependencies
npm install

# 2. Copy the example environment file and fill in your API key
cp .env.example .env.local
`

## Running Locally

`ash
npm run dev
`

The development server starts at http://localhost:3000.

## Running Tests

`ash
npm run test
`

Tests use **Vitest** and live in the 	ests/ directory. All tests must pass
before opening a pull request.

## Building

`ash
npm run build
`

Verify the production build passes before submitting changes.

## Guidelines

- Keep commits focused and write clear commit messages.
- Do not alter ercel.json or existing test expectations without discussion.
- Run 
pm run test and 
pm run build after every change.
