import { AsyncLocalStorage } from "async_hooks";

export const tenantStorage = new AsyncLocalStorage();

export const getHospitalIdContext = () => {
  const store = tenantStorage.getStore();
  return store ? store.hospitalId : null;
};
