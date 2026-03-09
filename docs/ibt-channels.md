# iRacing IBT Channels

Confirmed from real file — 288 channels total (AMV GT3 @ Sebring, 2026-03-08).

| Channel | Type | Count | Notes |
|---------|------|-------|-------|
| `AirDensity` | float | 1 | |
| `AirPressure` | float | 1 | Pa |
| `AirTemp` | float | 1 | °C — extracted |
| `Alt` | float | 1 | m |
| `Brake` | float | 1 | 0–1 — extracted |
| `BrakeABSactive` | bool | 1 | |
| `BrakeABScutPct` | float | 1 | |
| `BrakeRaw` | float | 1 | |
| `CFSRrideHeight` | float | 1 | m |
| `CarDistAhead` | float | 1 | m |
| `CarDistBehind` | float | 1 | m |
| `ChanAvgLatency` | float | 1 | |
| `ChanClockSkew` | float | 1 | |
| `ChanLatency` | float | 1 | |
| `ChanPartnerQuality` | float | 1 | |
| `ChanQuality` | float | 1 | |
| `Clutch` | float | 1 | |
| `ClutchRaw` | float | 1 | |
| `CpuUsageBG` | float | 1 | |
| `CpuUsageFG` | float | 1 | |
| `DriverMarker` | bool | 1 | |
| `Engine0_RPM` | float | 1 | |
| `EngineWarnings` | bitfield | 1 | |
| `EnterExitReset` | int | 1 | |
| `FastRepairAvailable` | int | 1 | |
| `FastRepairUsed` | int | 1 | |
| `FogLevel` | float | 1 | |
| `FrameRate` | float | 1 | |
| `FrontTireSetsAvailable` | int | 1 | |
| `FrontTireSetsUsed` | int | 1 | |
| `FuelLevel` | float | 1 | L — extracted |
| `FuelLevelPct` | float | 1 | 0–1 |
| `FuelPress` | float | 1 | |
| `FuelUsePerHour` | float | 1 | L/h |
| `Gear` | int | 1 | extracted |
| `GpuUsage` | float | 1 | |
| `HandbrakeRaw` | float | 1 | |
| `IsOnTrack` | bool | 1 | |
| `IsOnTrackCar` | bool | 1 | |
| `LFTiresAvailable` | int | 1 | |
| `LFTiresUsed` | int | 1 | |
| `LFbrakeLinePress` | float | 1 | kPa |
| `LFcoldPressure` | float | 1 | |
| `LFodometer` | float | 1 | |
| `LFpressure` | float | 1 | kPa — extracted |
| `LFrideHeight` | float | 1 | m — extracted |
| `LFshockDefl` | float | 6 | m — extracted |
| `LFshockVel` | float | 6 | m/s — extracted |
| `LFspeed` | float | 1 | m/s |
| `LFtempCL` | float | 1 | °C (center-left) |
| `LFtempCM` | float | 1 | °C (center-mid) |
| `LFtempCR` | float | 1 | °C (center-right) |
| `LFtempL` | float | 1 | °C — extracted |
| `LFtempM` | float | 1 | °C — extracted |
| `LFtempR` | float | 1 | °C — extracted |
| `LFwearL` | float | 1 | 0–1 |
| `LFwearM` | float | 1 | 0–1 |
| `LFwearR` | float | 1 | 0–1 |
| `LRTiresAvailable` | int | 1 | |
| `LRTiresUsed` | int | 1 | |
| `LRbrakeLinePress` | float | 1 | kPa |
| `LRcoldPressure` | float | 1 | |
| `LRodometer` | float | 1 | |
| `LRpressure` | float | 1 | kPa — extracted |
| `LRrideHeight` | float | 1 | m — extracted |
| `LRshockDefl` | float | 6 | m — extracted |
| `LRshockVel` | float | 6 | m/s — extracted |
| `LRspeed` | float | 1 | m/s |
| `LRtempCL` | float | 1 | °C |
| `LRtempCM` | float | 1 | °C |
| `LRtempCR` | float | 1 | °C |
| `LRtempL` | float | 1 | °C — extracted |
| `LRtempM` | float | 1 | °C — extracted |
| `LRtempR` | float | 1 | °C — extracted |
| `LRwearL` | float | 1 | 0–1 |
| `LRwearM` | float | 1 | 0–1 |
| `LRwearR` | float | 1 | 0–1 |
| `Lap` | int | 1 | extracted |
| `LapBestLap` | int | 1 | |
| `LapBestLapTime` | float | 1 | |
| `LapBestNLapLap` | int | 1 | |
| `LapBestNLapTime` | float | 1 | |
| `LapCompleted` | int | 1 | |
| `LapCurrentLapTime` | float | 1 | s |
| `LapDeltaToBestLap` | float | 1 | s |
| `LapDeltaToBestLap_DD` | float | 1 | |
| `LapDeltaToBestLap_OK` | bool | 1 | |
| `LapDeltaToOptimalLap` | float | 1 | s |
| `LapDeltaToOptimalLap_DD` | float | 1 | |
| `LapDeltaToOptimalLap_OK` | bool | 1 | |
| `LapDeltaToSessionBestLap` | float | 1 | |
| `LapDeltaToSessionBestLap_DD` | float | 1 | |
| `LapDeltaToSessionBestLap_OK` | bool | 1 | |
| `LapDeltaToSessionLastlLap` | float | 1 | |
| `LapDeltaToSessionLastlLap_DD` | float | 1 | |
| `LapDeltaToSessionLastlLap_OK` | bool | 1 | |
| `LapDeltaToSessionOptimalLap` | float | 1 | |
| `LapDeltaToSessionOptimalLap_DD` | float | 1 | |
| `LapDeltaToSessionOptimalLap_OK` | bool | 1 | |
| `LapDist` | float | 1 | m — extracted |
| `LapDistPct` | float | 1 | 0–1 |
| `LapLasNLapSeq` | int | 1 | |
| `LapLastLapTime` | float | 1 | s — extracted |
| `LapLastNLapTime` | float | 1 | |
| `Lat` | double | 1 | GPS latitude |
| `LatAccel` | float | 6 | m/s² |
| `LeftTireSetsAvailable` | int | 1 | |
| `LeftTireSetsUsed` | int | 1 | |
| `Lon` | double | 1 | GPS longitude |
| `LongAccel` | float | 6 | m/s² |
| `ManifoldPress` | float | 1 | bar |
| `ManualBoost` | bool | 1 | |
| `ManualNoBoost` | bool | 1 | |
| `MemPageFaultSec` | float | 1 | |
| `MemSoftPageFaultSec` | float | 1 | |
| `OilLevel` | float | 1 | L |
| `OilPress` | float | 1 | bar |
| `OilTemp` | float | 1 | °C |
| `OnPitRoad` | bool | 1 | |
| `P2P_Count` | int | 1 | |
| `P2P_Status` | bool | 1 | |
| `PaceMode` | int | 1 | |
| `PitOptRepairLeft` | float | 1 | |
| `PitRepairLeft` | float | 1 | |
| `PitSvFlags` | bitfield | 1 | |
| `PitSvFuel` | float | 1 | |
| `PitSvLFP` | float | 1 | |
| `PitSvLRP` | float | 1 | |
| `PitSvRFP` | float | 1 | |
| `PitSvRRP` | float | 1 | |
| `PitSvTireCompound` | int | 1 | |
| `Pitch` | float | 1 | rad |
| `PitchRate` | float | 6 | rad/s |
| `PitsOpen` | bool | 1 | |
| `PitstopActive` | bool | 1 | |
| `PlayerCarClass` | int | 1 | |
| `PlayerCarClassPosition` | int | 1 | |
| `PlayerCarDriverIncidentCount` | int | 1 | |
| `PlayerCarDryTireSetLimit` | int | 1 | |
| `PlayerCarIdx` | int | 1 | |
| `PlayerCarInPitStall` | bool | 1 | |
| `PlayerCarMyIncidentCount` | int | 1 | |
| `PlayerCarPitSvStatus` | int | 1 | |
| `PlayerCarPosition` | int | 1 | |
| `PlayerCarPowerAdjust` | float | 1 | |
| `PlayerCarTeamIncidentCount` | int | 1 | |
| `PlayerCarTowTime` | float | 1 | |
| `PlayerCarWeightPenalty` | float | 1 | |
| `PlayerFastRepairsUsed` | int | 1 | |
| `PlayerIncidents` | int | 1 | |
| `PlayerTireCompound` | int | 1 | |
| `PlayerTrackSurface` | int | 1 | |
| `PlayerTrackSurfaceMaterial` | int | 1 | |
| `Precipitation` | float | 1 | |
| `PushToPass` | bool | 1 | |
| `PushToTalk` | bool | 1 | |
| `RFTiresAvailable` | int | 1 | |
| `RFTiresUsed` | int | 1 | |
| `RFbrakeLinePress` | float | 1 | kPa |
| `RFcoldPressure` | float | 1 | |
| `RFodometer` | float | 1 | |
| `RFpressure` | float | 1 | kPa — extracted |
| `RFrideHeight` | float | 1 | m — extracted |
| `RFshockDefl` | float | 6 | m — extracted |
| `RFshockVel` | float | 6 | m/s — extracted |
| `RFspeed` | float | 1 | m/s |
| `RFtempCL` | float | 1 | °C |
| `RFtempCM` | float | 1 | °C |
| `RFtempCR` | float | 1 | °C |
| `RFtempL` | float | 1 | °C — extracted |
| `RFtempM` | float | 1 | °C — extracted |
| `RFtempR` | float | 1 | °C — extracted |
| `RFwearL` | float | 1 | 0–1 |
| `RFwearM` | float | 1 | 0–1 |
| `RFwearR` | float | 1 | 0–1 |
| `RPM` | float | 1 | extracted |
| `RRTiresAvailable` | int | 1 | |
| `RRTiresUsed` | int | 1 | |
| `RRbrakeLinePress` | float | 1 | kPa |
| `RRcoldPressure` | float | 1 | |
| `RRodometer` | float | 1 | |
| `RRpressure` | float | 1 | kPa — extracted |
| `RRrideHeight` | float | 1 | m — extracted |
| `RRshockDefl` | float | 6 | m — extracted |
| `RRshockVel` | float | 6 | m/s — extracted |
| `RRspeed` | float | 1 | m/s |
| `RRtempCL` | float | 1 | °C |
| `RRtempCM` | float | 1 | °C |
| `RRtempCR` | float | 1 | °C |
| `RRtempL` | float | 1 | °C — extracted |
| `RRtempM` | float | 1 | °C — extracted |
| `RRtempR` | float | 1 | °C — extracted |
| `RRwearL` | float | 1 | 0–1 |
| `RRwearM` | float | 1 | 0–1 |
| `RRwearR` | float | 1 | 0–1 |
| `RearTireSetsAvailable` | int | 1 | |
| `RearTireSetsUsed` | int | 1 | |
| `RelativeHumidity` | float | 1 | 0–1 (read via YAML regex) |
| `RightTireSetsAvailable` | int | 1 | |
| `RightTireSetsUsed` | int | 1 | |
| `Roll` | float | 1 | rad |
| `RollRate` | float | 6 | rad/s |
| `SessionFlags` | bitfield | 1 | |
| `SessionJokerLapsRemain` | int | 1 | |
| `SessionLapsRemain` | int | 1 | |
| `SessionLapsRemainEx` | int | 1 | |
| `SessionLapsTotal` | int | 1 | |
| `SessionNum` | int | 1 | |
| `SessionOnJokerLap` | bool | 1 | |
| `SessionState` | int | 1 | |
| `SessionTick` | int | 1 | |
| `SessionTime` | double | 1 | s — extracted |
| `SessionTimeOfDay` | float | 1 | s |
| `SessionTimeRemain` | double | 1 | |
| `SessionTimeTotal` | double | 1 | |
| `SessionUniqueID` | int | 1 | |
| `ShiftGrindRPM` | float | 1 | |
| `ShiftIndicatorPct` | float | 1 | |
| `ShiftPowerPct` | float | 1 | |
| `Shifter` | int | 1 | |
| `Skies` | int | 1 | |
| `SolarAltitude` | float | 1 | rad |
| `SolarAzimuth` | float | 1 | rad |
| `Speed` | float | 1 | m/s — extracted |
| `SteeringWheelAngle` | float | 1 | rad — extracted |
| `SteeringWheelAngleMax` | float | 1 | rad |
| `SteeringWheelLimiter` | float | 1 | |
| `SteeringWheelMaxForceNm` | float | 1 | Nm |
| `SteeringWheelPctDamper` | float | 1 | |
| `SteeringWheelPctIntensity` | float | 1 | |
| `SteeringWheelPctSmoothing` | float | 1 | |
| `SteeringWheelPctTorque` | float | 1 | |
| `SteeringWheelPctTorqueSign` | float | 1 | |
| `SteeringWheelPctTorqueSignStops` | float | 1 | |
| `SteeringWheelTorque` | float | 6 | Nm |
| `SteeringWheelTorque_ST` | float | 6 | Nm |
| `SteeringWheelUseLinear` | bool | 1 | |
| `Throttle` | float | 1 | 0–1 — extracted |
| `ThrottleRaw` | float | 1 | |
| `TireLF_RumblePitch` | float | 1 | |
| `TireLR_RumblePitch` | float | 1 | |
| `TireRF_RumblePitch` | float | 1 | |
| `TireRR_RumblePitch` | float | 1 | |
| `TireSetsAvailable` | int | 1 | |
| `TireSetsUsed` | int | 1 | |
| `TrackTemp` | float | 1 | °C — extracted |
| `TrackTempCrew` | float | 1 | °C |
| `TrackWetness` | int | 1 | |
| `VelocityX` | float | 6 | m/s |
| `VelocityY` | float | 6 | m/s |
| `VelocityZ` | float | 6 | m/s |
| `VertAccel` | float | 6 | m/s² |
| `Voltage` | float | 1 | V |
| `WaterLevel` | float | 1 | L |
| `WaterTemp` | float | 1 | °C |
| `WeatherDeclaredWet` | bool | 1 | |
| `WindDir` | float | 1 | rad |
| `WindVel` | float | 1 | m/s |
| `Yaw` | float | 1 | rad — extracted |
| `YawNorth` | float | 1 | rad |
| `YawRate` | float | 6 | rad/s |
| `dcABS` | float | 1 | driver control |
| `dcBrakeBias` | float | 1 | % — extracted |
| `dcDashPage` | float | 1 | |
| `dcHeadlightFlash` | bool | 1 | |
| `dcLowFuelAccept` | bool | 1 | |
| `dcPitSpeedLimiterToggle` | bool | 1 | |
| `dcPowerSteering` | float | 1 | driver control |
| `dcStarter` | bool | 1 | |
| `dcThrottleShape` | float | 1 | driver control |
| `dcToggleWindshieldWipers` | bool | 1 | |
| `dcTractionControl` | float | 1 | |
| `dcTractionControlToggle` | bool | 1 | |
| `dcTriggerWindshieldWipers` | bool | 1 | |
| `dpFastRepair` | float | 1 | pit service |
| `dpFuelAddKg` | float | 1 | |
| `dpFuelAutoFillActive` | float | 1 | |
| `dpFuelAutoFillEnabled` | float | 1 | |
| `dpFuelFill` | float | 1 | |
| `dpLFTireChange` | float | 1 | |
| `dpLFTireColdPress` | float | 1 | kPa |
| `dpLRTireChange` | float | 1 | |
| `dpLRTireColdPress` | float | 1 | kPa |
| `dpRFTireChange` | float | 1 | |
| `dpRFTireColdPress` | float | 1 | kPa |
| `dpRRTireChange` | float | 1 | |
| `dpRRTireColdPress` | float | 1 | kPa |
| `dpWindshieldTearoff` | float | 1 | |
