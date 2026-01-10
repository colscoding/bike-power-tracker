import { View } from '../router/View.js';
import { ViewId } from '../router/view-ids.js';
import { planRepository, type PlanProgress } from '../plans/planRepository.js';
import type { TrainingPlan, PlanWeek, PlanDay } from '../plans/types.js';
import { formatDuration } from '../api/workoutClient.js';
import { startStructuredWorkout } from '../ui/workoutPlayer.js';
import { WORKOUT_LIBRARY } from '../workouts/workoutLibrary.js';
import { getCustomWorkouts } from '../storage/customWorkouts.js';
import type { StructuredWorkout, WorkoutStep } from '../workouts/types.js';

export class PlansView implements View {
    public id = ViewId.Plans;
    private container: HTMLElement | null = null;

    public init(container: HTMLElement): void {
        this.container = container;
        this.render();
    }

    public onEnter(): void {
        console.log('Entered Plans View');
        this.render();
    }

    public onLeave(): void {
        console.log('Left Plans View');
    }

    private render(): void {
        if (!this.container) return;

        // Simple state checking to see if we are viewing details
        // For now, simpler to just always render dashboard, and handle details via innerHTML replacement
        // Ideally we would have sub-routes like /plans/:id
        this.renderDashboard();
    }

    private renderDashboard() {
        if (!this.container) return;
        const activeProgress = planRepository.getActiveProgress();
        const plans = planRepository.getAllPlans();

        let html = `
            <div class="page-header" style="padding: 16px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                <h2>📅 Training Plans</h2>
            </div>
            <div class="page-content" style="padding: 16px;">
        `;

        // Active Plan Section
        if (activeProgress) {
            const activePlan = planRepository.getPlan(activeProgress.planId);
            if (activePlan) {
                html += this.renderActivePlan(activePlan, activeProgress);
            }
        }

        // Available Plans Section
        html += `
            <h3>Available Plans</h3>
            <div class="plans-list" style="display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">
                ${plans.map(plan => this.renderPlanCard(plan, activeProgress?.planId === plan.id)).join('')}
            </div>
        </div>`;

        this.container.innerHTML = html;
        this.attachListeners(this.container);
    }

    private renderActivePlan(plan: TrainingPlan, progress: PlanProgress): string {
        const daysSinceStart = Math.floor((Date.now() - progress.startDate) / (1000 * 60 * 60 * 24));
        const currentWeekNum = Math.floor(daysSinceStart / 7) + 1;
        const currentDayNum = (daysSinceStart % 7) + 1;

        return `
            <div class="active-plan-card" style="background: var(--card-bg); padding: 16px; border-radius: 8px; margin-bottom: 24px; border: 2px solid var(--color-primary);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <h3 style="margin: 0;">Currently Following: ${plan.name}</h3>
                    <span class="status-badge" style="background: var(--color-primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8em;">Active</span>
                </div>
                <p><strong>Week ${currentWeekNum}, Day ${currentDayNum}</strong></p>
                <div style="margin-top: 12px;">
                    <button class="workout-btn btn-stop-plan" data-id="${plan.id}" style="background: var(--color-error); font-size: 0.9em;">Stop Plan</button>
                    <button class="workout-btn btn-view-plan" data-id="${plan.id}" style="font-size: 0.9em;">View Schedule</button>
                </div>
            </div>
        `;
    }

    private renderPlanCard(plan: TrainingPlan, isActive: boolean): string {
        return `
            <div class="plan-card" style="background: var(--card-bg); padding: 16px; border-radius: 8px; border: 1px solid var(--color-border); ${isActive ? 'opacity: 0.6;' : ''}">
                <h4 style="margin: 0 0 8px 0;">${plan.name}</h4>
                <div style="font-size: 0.9em; color: var(--color-text-secondary); margin-bottom: 12px;">
                    ${plan.weeks.length} Weeks • ${plan.difficulty || 'Intermediate'}
                </div>
                <p style="font-size: 0.9em; margin-bottom: 16px; line-height: 1.4;">${plan.description}</p>
                <button class="workout-btn btn-view-plan" data-id="${plan.id}" style="width: 100%;">View Details</button>
            </div>
        `;
    }

    private renderDetails(planId: string) {
        if (!this.container) return;
        const plan = planRepository.getPlan(planId);
        if (!plan) return;

        const progress = planRepository.getActiveProgress();
        const isActive = progress?.planId === planId;

        let html = `
            <div class="page-header" style="padding: 16px; border-bottom: 1px solid var(--color-border); display: flex; gap: 8px; align-items: center;">
                <button class="btn-back-plans" style="background: none; border: none; font-size: 1.2em; cursor: pointer;">←</button>
                <h2 style="margin: 0;">${plan.name}</h2>
            </div>
            <div class="page-content" style="padding: 16px;">
                <p>${plan.description}</p>
                
                <div style="margin: 16px 0;">
                    ${isActive
                ? `<button class="workout-btn btn-stop-plan" data-id="${plan.id}" style="background: var(--color-error);">Stop Plan</button>`
                : `<button class="workout-btn btn-start-plan" data-id="${plan.id}" style="background: var(--color-success);">Start Plan</button>`
            }
                </div>
    
                <div class="plan-weeks">
                    ${plan.weeks.map(week => this.renderWeek(week, isActive ? progress : null)).join('')}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.attachListeners(this.container, planId);
    }

    private renderWeek(week: PlanWeek, progress: PlanProgress | null): string {
        return `
            <div class="plan-week" style="margin-bottom: 20px;">
                <h4 style="background: var(--bg-secondary); padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                    Week ${week.weekNumber}: ${week.focus || ''}
                </h4>
                <div class="week-days" style="display: grid; gap: 8px;">
                    ${week.days.map(day => this.renderDay(day, week.weekNumber, progress)).join('')}
                </div>
            </div>
        `;
    }

    private renderDay(day: PlanDay, weekNum: number, progress: PlanProgress | null): string {
        const isComplete = progress ? progress.completedDays[`${weekNum}-${day.dayOfWeek}`] : false;

        let isToday = false;
        if (progress) {
            const daysSinceStart = Math.floor((Date.now() - progress.startDate) / (1000 * 60 * 60 * 24));
            const currentDayAbsolute = daysSinceStart + 1;
            const thisDayAbsolute = ((weekNum - 1) * 7) + day.dayOfWeek;
            if (currentDayAbsolute === thisDayAbsolute) isToday = true;
        }

        let content = '';
        if (day.isRestDay) {
            content = `<em>Rest Day</em> ${day.notes ? `- ${day.notes}` : ''}`;
        } else if (day.workout) {
            content = `<strong>${day.workout.name}</strong><br><span style="font-size: 0.85em; color: var(--color-text-secondary);">${formatDuration(this.getTotalDuration(day.workout))}</span>`;
        } else {
            content = `Workout ID: ${day.workoutId}`;
        }

        return `
            <div class="plan-day" style="
                padding: 12px; 
                border: 1px solid var(--color-border); 
                border-radius: 6px; 
                display: flex; 
                align-items: center; 
                gap: 12px;
                background: ${isToday ? 'var(--bg-highlight, rgba(33, 150, 243, 0.1))' : 'var(--card-bg)'};
                ${isToday ? 'border-color: var(--color-primary);' : ''}
            ">
                <div style="
                    width: 24px; height: 24px; 
                    border-radius: 50%; 
                    background: ${isComplete ? 'var(--color-success)' : '#ccc'}; 
                    color: white;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 0.8em;
                ">${day.dayOfWeek}</div>
                
                <div style="flex: 1;">${content}</div>
    
                ${!day.isRestDay && day.workout ? `
                    <button class="workout-btn btn-preview-workout" style="padding: 4px 8px; font-size: 0.8em;">Preview</button>
                    ${progress && !isComplete ? `<button class="workout-btn btn-do-workout" data-week="${weekNum}" data-day="${day.dayOfWeek}" style="margin-left:8px; padding: 4px 8px; font-size: 0.8em; background: var(--color-primary);">Start</button>` : ''}
                ` : ''}
            </div>
        `;
    }

    private getTotalDuration(workout: StructuredWorkout): number {
        return workout.steps.reduce((sum: number, step: WorkoutStep) => sum + step.duration, 0);
    }

    private attachListeners(container: HTMLElement, currentDetailId?: string) {
        container.onclick = (e) => {
            const target = e.target as HTMLElement;

            if (target.classList.contains('btn-view-plan')) {
                const id = target.dataset.id;
                if (id) this.renderDetails(id);
            }

            if (target.classList.contains('btn-back-plans')) {
                this.renderDashboard();
            }

            if (target.classList.contains('btn-start-plan')) {
                const id = target.dataset.id;
                if (id && confirm('Start this training plan? This will become your active plan.')) {
                    planRepository.startPlan(id);
                    this.renderDetails(id); // Re-render to show stop button
                }
            }

            if (target.classList.contains('btn-stop-plan')) {
                if (confirm('Are you sure you want to stop the current plan? Progress will be lost.')) {
                    planRepository.stopActivePlan();
                    if (currentDetailId) {
                        this.renderDetails(currentDetailId);
                    } else {
                        this.renderDashboard();
                    }
                }
            }

            if (target.classList.contains('btn-do-workout')) {
                const weekNum = parseInt(target.dataset.week || '0');
                const dayNum = parseInt(target.dataset.day || '0');

                const progress = planRepository.getActiveProgress();
                if (!progress) return;

                const plan = planRepository.getPlan(progress.planId);
                if (!plan) return;

                const week = plan.weeks.find(w => w.weekNumber === weekNum);
                const day = week?.days.find(d => d.dayOfWeek === dayNum);

                if (day) {
                    let workout: StructuredWorkout | undefined = day.workout;

                    if (!workout && day.workoutId) {
                        // Resolve ID
                        workout = WORKOUT_LIBRARY.find(w => w.id === day.workoutId)
                            || getCustomWorkouts().find(w => w.id === day.workoutId);
                    }

                    if (workout) {
                        startStructuredWorkout(workout, () => {
                            planRepository.markDayComplete(weekNum, dayNum);
                            // Refresh view to show progress
                            this.render();
                        });
                    } else {
                        alert('Workout definition not found!');
                    }
                }
            }
        };
    }
}
