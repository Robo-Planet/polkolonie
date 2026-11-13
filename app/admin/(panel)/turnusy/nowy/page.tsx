import { TurnusForm } from "@/components/TurnusForm";
import { createTurnus } from "../actions";

export default function NowyTurnusPage() {
  return (
    <>
      <h1>Nowy turnus</h1>
      <TurnusForm
        action={createTurnus}
        defaults={{ season: "Z27", minAge: "5", deposit: "200", discount: "50", hoursFrom: "07:45", hoursTo: "16:30", active: "on" }}
      />
    </>
  );
}
