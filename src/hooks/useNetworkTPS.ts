import { useSolana } from "@saberhq/use-solana";
import { useQuery } from "react-query";

/**
 * Returns the current network TPS.
 * @returns
 */
export const useNetworkTPS = () => {
  const { network, connection } = useSolana();
  return useQuery(["networkTps", network], async () => {
    const performanceSamples = await connection.getRecentPerformanceSamples(15);
    const avgTpsSamples = performanceSamples
      .filter((sample) => sample.numTransactions !== 0)
      .map((sample) => sample.numTransactions / sample.samplePeriodSecs);
    return avgTpsSamples.reduce((a, b) => a + b) / avgTpsSamples.length;
  });
};
