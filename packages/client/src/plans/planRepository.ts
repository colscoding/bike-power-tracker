import type { TrainingPlan } from './types.js';
import { ftpBuilderPlan } from './library/ftpBuilder.js';

export interface PlanProgress {
    planId: string;
    startDate: number; // Timestamp
    completedDays: Record<string, boolean>; // key format: "week-day" e.g. "1-2" (Week 1, Tuesday)
}

const STORAGE_KEY_PLANS = 'bpt-user-plans';
const STORAGE_KEY_PROGRESS = 'bpt-plan-progress';

class PlanRepository {
    private systemPlans: TrainingPlan[] = [];

    constructor() {
        this.registerSystemPlan(ftpBuilderPlan);
    }

    public registerSystemPlan(plan: TrainingPlan) {
        this.systemPlans.push(plan);
    }

    public getAllPlans(): TrainingPlan[] {
        const userPlans = this.getUserPlans();
        return [...this.systemPlans, ...userPlans];
    }

    public getPlan(id: string): TrainingPlan | undefined {
        return this.getAllPlans().find(p => p.id === id);
    }

    public getUserPlans(): TrainingPlan[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PLANS);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Failed to load user plans', e);
            return [];
        }
    }

    public saveUserPlan(plan: TrainingPlan): void {
        const plans = this.getUserPlans();
        const existingIndex = plans.findIndex(p => p.id === plan.id);

        if (existingIndex >= 0) {
            plans[existingIndex] = plan;
        } else {
            plans.push(plan);
        }

        localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(plans));
    }

    public getActiveProgress(): PlanProgress | null {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    public startPlan(planId: string, startDate: number = Date.now()): void {
        const progress: PlanProgress = {
            planId,
            startDate,
            completedDays: {}
        };
        localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progress));
    }

    public markDayComplete(week: number, day: number): void {
        const progress = this.getActiveProgress();
        if (!progress) return; // No active plan

        const key = `${week}-${day}`;
        progress.completedDays[key] = true;
        localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progress));
    }

    public stopActivePlan(): void {
        localStorage.removeItem(STORAGE_KEY_PROGRESS);
    }
}

export const planRepository = new PlanRepository();
