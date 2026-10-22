import type { ReactNode } from "react";
import type { CookbookRepository } from "../data/CookbookRepository";
import {
  HttpCookbookDocumentClient,
  type CookbookDocumentClient,
} from "../data/CookbookDocumentClient";
import { FixtureCookbookRepository } from "../data/FixtureCookbookRepository";
import { CookbookDocumentProvider } from "../features/cookbook/CookbookDocumentProvider";
import { PrototypeProvider, usePrototype } from "../prototype/PrototypeProvider";
import { AppRouter } from "./router";
import "./styles.css";

const fixtureRepository = new FixtureCookbookRepository();
const defaultDocumentClient = new HttpCookbookDocumentClient();

function CookbookDocumentBoundary({
  children,
  client,
}: {
  children: ReactNode;
  client: CookbookDocumentClient;
}) {
  const { snapshot } = usePrototype();
  return (
    <CookbookDocumentProvider client={client} mediaSnapshot={snapshot}>
      {children}
    </CookbookDocumentProvider>
  );
}

export function App({
  repository = fixtureRepository,
  documentClient,
}: {
  repository?: CookbookRepository;
  documentClient?: CookbookDocumentClient | null;
}) {
  const activeDocumentClient = documentClient === undefined
    ? (repository === fixtureRepository ? defaultDocumentClient : undefined)
    : (documentClient ?? undefined);
  const routes = <AppRouter />;

  return (
    <PrototypeProvider repository={repository}>
      {activeDocumentClient === undefined ? routes : (
        <CookbookDocumentBoundary client={activeDocumentClient}>
          {routes}
        </CookbookDocumentBoundary>
      )}
    </PrototypeProvider>
  );
}
