import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type {
  MainTabParamList,
  MapStackParamList,
  SearchStackParamList,
  ScanStackParamList,
  TasksStackParamList,
} from './types';
import { colors } from '@/theme/colors';

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

import { MapMainScreen } from '@/screens/map/MapMainScreen';
import { SearchMainScreen } from '@/screens/search/SearchMainScreen';
import { ScannerScreen } from '@/screens/scanner/ScannerScreen';
import { AssignTrackerScreen } from '@/screens/scan/AssignTrackerScreen';
import { TasksMainScreen } from '@/screens/tasks/TasksMainScreen';
import { AccountScreen } from '@/screens/account/AccountScreen';
import { UnitDetailScreen } from '@/screens/UnitDetailScreen';

// ---------------------------------------------------------------------------
// Nested Stack: Map
// ---------------------------------------------------------------------------

const MapStack = createNativeStackNavigator<MapStackParamList>();

const MapStackScreen: React.FC = () => (
  <MapStack.Navigator screenOptions={{ headerShown: false }}>
    <MapStack.Screen name="MapMain" component={MapMainScreen} />
    <MapStack.Screen name="UnitDetail" component={UnitDetailScreen} />
  </MapStack.Navigator>
);

// ---------------------------------------------------------------------------
// Nested Stack: Search
// ---------------------------------------------------------------------------

const SearchStack = createNativeStackNavigator<SearchStackParamList>();

const SearchStackScreen: React.FC = () => (
  <SearchStack.Navigator screenOptions={{ headerShown: false }}>
    <SearchStack.Screen name="SearchMain" component={SearchMainScreen} />
    <SearchStack.Screen name="UnitDetail" component={UnitDetailScreen} />
  </SearchStack.Navigator>
);

// ---------------------------------------------------------------------------
// Nested Stack: Scan
// ---------------------------------------------------------------------------

const ScanStack = createNativeStackNavigator<ScanStackParamList>();

const ScanStackScreen: React.FC = () => (
  <ScanStack.Navigator screenOptions={{ headerShown: false }}>
    <ScanStack.Screen name="ScanMain" component={ScannerScreen} />
    <ScanStack.Screen name="AssignTracker" component={AssignTrackerScreen} />
  </ScanStack.Navigator>
);

// ---------------------------------------------------------------------------
// Nested Stack: Tasks
// ---------------------------------------------------------------------------

const TasksStack = createNativeStackNavigator<TasksStackParamList>();

const TasksStackScreen: React.FC = () => (
  <TasksStack.Navigator screenOptions={{ headerShown: false }}>
    <TasksStack.Screen name="TasksMain" component={TasksMainScreen} />
    <TasksStack.Screen name="UnitDetail" component={UnitDetailScreen} />
  </TasksStack.Navigator>
);

// ---------------------------------------------------------------------------
// Bottom Tab Navigator
// ---------------------------------------------------------------------------

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Map"
        component={MapStackScreen}
        options={{
          tabBarLabel: 'Map',
          tabBarIcon: ({ color }) => (
            <Ionicons name="map-outline" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchStackScreen}
        options={{
          tabBarLabel: 'Search',
          tabBarIcon: ({ color }) => (
            <Ionicons name="search-outline" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanStackScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color }) => (
            <Ionicons name="qr-code-outline" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksStackScreen}
        options={{
          tabBarLabel: 'Tasks',
          tabBarIcon: ({ color }) => (
            <Ionicons name="clipboard-outline" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          tabBarLabel: 'Account',
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-outline" size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};
