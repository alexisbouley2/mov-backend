import { validateEnv, type EnvConfig } from './validation.schema';

export default (): EnvConfig => {
  return validateEnv(process.env);
};
