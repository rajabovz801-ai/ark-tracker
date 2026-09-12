'use client';

import { useEffect, useState } from 'react';
import ArkTrackerV2 from './ArkTrackerV2';
import DashboardEnhancer from './DashboardEnhancer';
import ReportsEnhancer from './ReportsEnhancer';
import ReportsNavFix from './ReportsNavFix';
import StudentLifecycleEnhancer from './StudentLifecycleEnhancer';
import ResultsBoardEnhancer from './ResultsBoardEnhancer';
import ShopCrudEnhancer from './ShopCrudEnhancer';

export default function Page() {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('ark-tracker-state-updated', refresh);
    return () => window.removeEventListener('ark-tracker-state-updated', refresh);
  }, []);

  return <>
    <ArkTrackerV2 key={`tracker-${revision}`}/>
    <DashboardEnhancer key={`dashboard-${revision}`}/>
    <ReportsEnhancer key={`reports-${revision}`}/>
    <ReportsNavFix key={`reports-nav-${revision}`}/>
    <StudentLifecycleEnhancer key={`lifecycle-${revision}`}/>
    <ResultsBoardEnhancer key={`results-board-${revision}`}/>
    <ShopCrudEnhancer key={`shop-crud-${revision}`}/>
  </>;
}
