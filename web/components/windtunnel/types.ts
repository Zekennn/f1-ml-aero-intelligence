import type { AeroResult, Coefficients } from "@/lib/aeroPhysics";
import type { ModeId, SetupId } from "@/lib/car2026";

/** The aero calculator inputs. */
export type AeroInputs = {
  speedKmh: number;
  mode: ModeId;
  setup: SetupId;
  tempC: number;
  altitudeM: number;
};

/** Everything the wind tunnel shows, computed from the inputs by the physics model. */
export type AeroModel = {
  inputs: AeroInputs;
  rho: number; // air density, kg/m³
  coeffs: Coefficients; // for the current setup and mode
  flaps: { front: number; rear: number; rearMain: number; rearClosed: number }; // degrees
  result: AeroResult; // current mode
  corner: AeroResult; // same speed, setup and air, Corner Mode
  straight: AeroResult; // same speed, setup and air, Straight Mode
};
