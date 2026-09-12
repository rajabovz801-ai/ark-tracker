'use client';

import { useEffect, useState } from 'react';
import ArkTrackerV2 from './ArkTrackerV2';
import DashboardEnhancer from './DashboardEnhancer';
import ReportsEnhancer from './ReportsEnhancer';
import ReportsNavFix from './ReportsNavFix';
import StudentLifecycleEnhancer from './StudentLifecycleEnhancer';
import ResultsBoardEnhancer from './ResultsBoardEnhancer';
import ShopCrudEnhancer from './ShopCrudEnhancer';
import RuntimeHardening from './RuntimeHardening';

const REMOUNT_SOURCES = new Set(['student-lifecycle','access-center','shop-crud','cloud-remote']);

export default function Page() {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = event => {
      const source = event?.detail?.source || '';
      if (REMOUNT_SOURCES.has(source)) setRevision(value => value + 1);
    };
    window.addEventListener('ark-tracker-state-updated', refresh);
    return () => window.removeEventListener('ark-tracker-state-updated', refresh);
  }, []);

  return <>
    <ArkTrackerV2 key={`tracker-${revision}`}/>
    <RuntimeHardening/>
    <ReportsNavFix/>
    <DashboardEnhancer/>
    <ReportsEnhancer/>
    <StudentLifecycleEnhancer/>
    <ResultsBoardEnhancer/>
    <ShopCrudEnhancer/>
  </>;
}
