import { defineRailway, github, postgres, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "asia-southeast1-eqsg3a" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "asia-southeast1-eqsg3a", sizeMB: 5000 });
  const blodWebsite = service("blod-website", {
    source: github("HUZAIFASAJJAD012/blod-website", { branch: "main", checkSuites: false }),
    build: { buildEnvironment: "V3", builder: "RAILPACK" },
    start: "pnpm run start",
    preDeploy: "pnpm prisma migrate deploy",
    healthcheck: "/api/health",
    healthcheckTimeout: 300,
    replicas: { "asia-southeast1-eqsg3a": 1 },
  });

  return project("valiant-possibility", {
    variables: { managed: false },
    resources: [blodWebsite, Postgres, postgresVolume],
  });
});
