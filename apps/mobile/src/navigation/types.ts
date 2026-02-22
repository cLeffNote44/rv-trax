import type { NavigatorScreenParams } from '@react-navigation/native';

// ---------------------------------------------------------------------------
// Auth Stack
// ---------------------------------------------------------------------------

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

// ---------------------------------------------------------------------------
// Main Tab Navigator
// ---------------------------------------------------------------------------

export type MainTabParamList = {
  Map: NavigatorScreenParams<MapStackParamList>;
  Search: NavigatorScreenParams<SearchStackParamList>;
  Scan: NavigatorScreenParams<ScanStackParamList>;
  Tasks: NavigatorScreenParams<TasksStackParamList>;
  Account: undefined;
};

// ---------------------------------------------------------------------------
// Nested Stacks (per tab)
// ---------------------------------------------------------------------------

export type MapStackParamList = {
  MapMain: undefined;
  UnitDetail: { unitId: string };
};

export type SearchStackParamList = {
  SearchMain: undefined;
  UnitDetail: { unitId: string };
};

export type ScanStackParamList = {
  ScanMain: undefined;
  AssignTracker: { unitId: string };
};

export type TasksStackParamList = {
  TasksMain: undefined;
  UnitDetail: { unitId: string };
};

// ---------------------------------------------------------------------------
// Root Stack (Auth vs Main split)
// ---------------------------------------------------------------------------

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  UnitDetail: { unitId: string };
};

// ---------------------------------------------------------------------------
// Utility type – makes useNavigation / useRoute fully typed
// ---------------------------------------------------------------------------

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
