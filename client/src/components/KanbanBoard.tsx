import { useState } from "react";
import { createPortal } from "react-dom";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { ChevronDown } from "lucide-react";
import {
  JobApplicationStatus,
  type JobApplication,
} from "../types";
import { formatDateDe } from "../lib/utils";

interface KanbanBoardProps {
  columns: Record<JobApplicationStatus, JobApplication[]>;
  onCardClick: (application: JobApplication) => void;
  onDragEnd: (result: DropResult) => void;
}

const boardColumns = [
  {
    status: JobApplicationStatus.Applied,
    title: "Applied",
    subtitle: "Fresh outreach",
    borderClass: "border-l-column-applied",
    accentClass: "text-column-applied",
    frameClass: "deco-frame border-border-gold",
  },
  {
    status: JobApplicationStatus.Interviewing,
    title: "Interviewing",
    subtitle: "Active conversations",
    borderClass: "border-l-column-interviewing",
    accentClass: "text-column-interviewing",
    frameClass: "deco-frame border-border-gold",
  },
  {
    status: JobApplicationStatus.Rejected,
    title: "Rejected",
    subtitle: "Closed loops",
    borderClass: "border-l-column-rejected",
    accentClass: "text-column-rejected",
    frameClass: "deco-frame border-border-gold",
  },
  {
    status: JobApplicationStatus.Offer,
    title: "Offer",
    subtitle: "Decision stage",
    borderClass: "border-l-column-offer",
    accentClass: "text-column-offer",
    frameClass: "deco-frame border-border-gold",
  },
] as const;

const mobileAccordionDefaults: Record<JobApplicationStatus, boolean> = {
  [JobApplicationStatus.Applied]: true,
  [JobApplicationStatus.Interviewing]: false,
  [JobApplicationStatus.Rejected]: false,
  [JobApplicationStatus.Offer]: false,
};

const renderCardContent = (application: JobApplication) => (
  <div className="grid min-w-0 gap-1">
    <span className="truncate text-sm font-semibold uppercase tracking-[0.08em] text-deco-foreground">
      {application.companyName}
    </span>
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <span className="truncate text-left text-xs  text-deco-muted">
        {application.position}
      </span>
      <span className="shrink-0 text-right text-xs tabular-nums  text-deco-muted">
        {formatDateDe(application.dateApplied)}
      </span>
    </div>
  </div>
);

export const KanbanBoard = ({
  columns,
  onCardClick,
  onDragEnd,
}: KanbanBoardProps) => {
  const [mobileExpandedColumns, setMobileExpandedColumns] = useState<
    Record<JobApplicationStatus, boolean>
  >(mobileAccordionDefaults);

  const toggleMobileColumn = (status: JobApplicationStatus) => {
    setMobileExpandedColumns((current) => ({
      ...current,
      [status]: !current[status],
    }));
  };

  return (
    <>
      <div className="w-full space-y-4 md:hidden">
        {boardColumns.map((column) => {
          const isExpanded = mobileExpandedColumns[column.status];

          return (
            <section
              className={`kanban-column w-full ${column.frameClass} bg-deco-surface-soft p-4`}
              id={`column-${column.title.toLowerCase()}`}
              key={column.status}
            >
              <button
                aria-expanded={isExpanded}
                className="flex w-full items-start justify-between gap-3 text-left"
                onClick={() => toggleMobileColumn(column.status)}
                type="button"
              >
                <div>
                  <h3 className="text-2xl text-deco-foreground">
                    {column.title}
                  </h3>
                  <p className="mt-1 text-sm text-deco-muted">
                    {column.subtitle}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={column.accentClass}>
                    {columns[column.status].length}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-deco-muted transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {isExpanded ? (
                <div className="mt-4 flex flex-col gap-2">
                  {columns[column.status].map((application) => (
                    <article
                      className={`application-card ${column.borderClass} deco-frame cursor-default select-none border-border-gold-muted bg-deco-card px-3 py-2 font-sans text-deco-foreground shadow-sm transition-shadow hover:shadow-deco-glow`}
                      key={application.id}
                      onClick={() => onCardClick(application)}
                    >
                      {renderCardContent(application)}
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="hidden md:block" data-tour-id="tracker-board">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid min-h-0 flex-1 gap-5 md:grid-cols-4">
            {boardColumns.map((column) => (
              <section
                className={`kanban-column w-full ${column.frameClass} bg-deco-surface-soft p-4`}
                id={`column-${column.title.toLowerCase()}`}
                key={column.status}
              >
                <div className="border-b border-primary-gold pb-3">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <h3 className="text-2xl text-deco-foreground">
                        {column.title}
                      </h3>
                      <p className="mt-1 text-sm text-deco-muted">
                        {column.subtitle}
                      </p>
                    </div>
                    <span className={column.accentClass}>
                      {columns[column.status].length}
                    </span>
                  </div>
                </div>

                <Droppable droppableId={String(column.status)}>
                  {(droppableProvided, droppableSnapshot) => (
                    <div
                      className={`mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2 transition-colors ${
                        droppableSnapshot.isDraggingOver
                          ? "bg-primary-gold-muted"
                          : ""
                      }`}
                      ref={droppableProvided.innerRef}
                      {...droppableProvided.droppableProps}
                    >
                      {columns[column.status].map(
                        (application, index) => (
                          <Draggable
                            draggableId={application.id}
                            index={index}
                            key={application.id}
                          >
                            {(draggableProvided, draggableSnapshot) => {
                              const { style, ...draggableProps } =
                                draggableProvided.draggableProps;
                              const draggableCard = (
                                <article
                                  className={`application-card ${column.borderClass} deco-frame cursor-grab select-none border-border-gold-muted bg-deco-card px-3 py-2 font-sans text-deco-foreground shadow-sm transition-shadow hover:shadow-deco-glow active:cursor-grabbing ${
                                    draggableSnapshot.isDragging
                                      ? "shadow-deco-glow"
                                      : ""
                                  }`}
                                  key={application.id}
                                  ref={draggableProvided.innerRef}
                                  {...draggableProps}
                                  {...draggableProvided.dragHandleProps}
                                  style={style}
                                  onClick={() => onCardClick(application)}
                                >
                                  {renderCardContent(application)}
                                </article>
                              );

                              if (
                                draggableSnapshot.isDragging &&
                                typeof document !== "undefined"
                              ) {
                                return createPortal(
                                  draggableCard,
                                  document.body,
                                );
                              }

                              return draggableCard;
                            }}
                          </Draggable>
                        ),
                      )}
                      {droppableProvided.placeholder}
                    </div>
                  )}
                </Droppable>
              </section>
            ))}
          </div>
        </DragDropContext>
      </div>
    </>
  );
};
