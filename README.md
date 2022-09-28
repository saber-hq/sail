# sail ⛵️

[![NPM](https://img.shields.io/npm/v/@saberhq/sail)](https://www.npmjs.com/package/@saberhq/sail)
[![License](https://img.shields.io/npm/l/@saberhq/sail)](https://github.com/saber-hq/sail/blob/master/LICENSE)
[![Build Status](https://img.shields.io/github/workflow/status/saber-hq/sail/CI/master)](https://github.com/saber-hq/sail/actions/workflows/main.yml?query=branch%3Amaster)
[![Contributors](https://img.shields.io/github/contributors/saber-hq/sail)](https://github.com/saber-hq/sail/graphs/contributors)

A React library for Solana account management and transaction handling.

## Setup

Run:

```bash
yarn add @saberhq/sail react-query
```

## Usage

You will need to first [set up React Query](https://react-query.tanstack.com/installation).

Then:

```typescript
import { SailProvider } from "@saberhq/sail";
import { QueryClient, QueryClientProvider } from "react-query";

const queryClient = new QueryClient();

const MyApp: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <SailProvider initialState={{ onTxSend, onSailError }}>
      {/* stuff */}
    </SailProvider>
  </QueryClientProvider>
);
```

## Examples

The most prominent open source example is the [Friktion frontend](https://github.com/Friktion-Labs/frontend).

You can view a list of open source GitHub projects that use Sail [here](https://github.com/saber-hq/sail/network/dependents).

## License

Sail is licensed under the Apache License, Version 2.0.
