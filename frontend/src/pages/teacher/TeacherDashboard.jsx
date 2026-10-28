import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import { ArrowRight, ExternalLink, SquareCheckBig, User } from 'lucide-react';
import '../tg/Screen-5.screen.css';

export default function TeacherDashboard() {
  const { currentUser } = useERP();
  const navigate = useNavigate();

  return (
    <div data-appearance="light" className="flex flex-col gap-6 sm:gap-8 w-full pb-10">
      <section className="flex flex-col gap-3 sm:gap-5">
        <span className="font-bold uppercase rounded-full sm:bg-primary/10 text-primary text-xs tracking-wider sm:px-3 sm:py-1 inline-flex w-fit max-w-fit">
          TEACHER WORKSPACE
        </span>

        <div className="shadow-sm rounded-xl bg-card border border-border flex p-6 sm:p-8 justify-between items-start gap-8">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="rounded-lg bg-primary text-primary-foreground flex justify-center items-center shrink-0 size-12 sm:size-14">
              <User className="size-6 sm:size-7" />
            </div>
            <div>
              <h1 className="font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
                Welcome back, {currentUser?.name || 'Professor'}!
              </h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                View approved attendance consideration records for your department.
              </p>
              <div className="flex mt-4 sm:mt-5 flex-wrap items-center gap-2 sm:gap-3">
                <span className="font-semibold rounded-full bg-accent text-accent-foreground text-xs sm:text-sm border border-accent inline-flex px-3 py-1.5 items-center gap-2">
                  <span className="rounded-full bg-primary size-2" />
                  Active Faculty
                </span>
                <span className="rounded-full bg-muted text-muted-foreground text-xs sm:text-sm border border-border px-3 py-1.5 font-medium">
                  Department: Computer Science and Engineering
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:gap-5 grid-cols-1">
        <div className="shadow-sm rounded-xl bg-card border border-border flex p-6 flex-col justify-between min-h-56 sm:min-h-64 transition-all hover:border-primary/40 hover:shadow-md">
          <div>
            <div className="flex justify-between items-start gap-4">
              <div className="rounded-lg bg-secondary text-secondary-foreground flex justify-center items-center size-10 sm:size-11">
                <SquareCheckBig className="size-5" />
              </div>
              <ExternalLink className="text-muted-foreground size-4 hidden sm:block" />
            </div>
            <h2 className="font-bold text-base sm:text-lg mt-4 sm:mt-6 text-foreground">
              Attendance Consideration Records
            </h2>
            <p className="text-muted-foreground text-sm leading-6 mt-1 sm:mt-2">
              Approved attendance clearances and official records
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/teacher/considerations')}
            className="font-bold text-primary text-sm inline-flex mt-4 sm:mt-6 items-center gap-2 hover:underline cursor-pointer min-h-11 sm:min-h-0"
          >
            View Records
            <ExternalLink className="size-4" />
          </button>
        </div>
      </section>

      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => navigate('/teacher/considerations')}
          className="text-left shadow-sm rounded-xl bg-primary text-primary-foreground flex px-4 justify-between items-center w-full min-h-12 cursor-pointer hover:bg-primary/90 transition-colors"
        >
          <span className="flex items-center gap-3">
            <SquareCheckBig className="size-5" />
            <span>
              <span className="font-bold text-base block">Attendance Consideration</span>
              <span className="text-primary-foreground/80 text-xs block">View approved records</span>
            </span>
          </span>
          <ArrowRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
