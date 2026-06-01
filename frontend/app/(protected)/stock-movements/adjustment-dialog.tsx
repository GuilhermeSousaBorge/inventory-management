"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isApiError } from "@/lib/auth";
import { useAllIngredients } from "@/lib/ingredients";
import {
  ADJUSTMENT_DIRECTIONS,
  type CreateAdjustmentInput,
  createAdjustmentSchema,
  useCreateAdjustment,
} from "@/lib/stock-movements";
import { useAllUnits } from "@/lib/units";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AdjustmentDialog({ open, onClose }: Props) {
  const ingredients = useAllIngredients();
  const units = useAllUnits();
  const create = useCreateAdjustment();

  const form = useForm<CreateAdjustmentInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createAdjustmentSchema) as any,
    defaultValues: {
      ingredientId: "",
      unitId: "",
      quantity: 0,
      direction: "INCREASE",
      reason: "",
    },
  });

  async function onSubmit(values: CreateAdjustmentInput) {
    try {
      await create.mutateAsync(values);
      toast.success("Ajuste registrado");
      form.reset();
      onClose();
    } catch (err) {
      if (isApiError(err)) toast.error(err.message);
      else toast.error("Erro ao registrar ajuste");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo ajuste de estoque</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            id="adjustment-form"
            className="space-y-3"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="ingredientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ingrediente</FormLabel>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ingredients.data?.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unitId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade</FormLabel>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {units.data?.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      {...field}
                      value={field.value ?? 0}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <fieldset>
              <legend className="mb-1 text-sm font-medium text-foreground">
                Direção
              </legend>
              <div className="flex gap-4">
                {ADJUSTMENT_DIRECTIONS.map((d) => (
                  <label key={d} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      value={d}
                      {...form.register("direction")}
                    />
                    {d === "INCREASE" ? "Aumentar" : "Diminuir"}
                  </label>
                ))}
              </div>
            </fieldset>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={create.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="adjustment-form"
            disabled={create.isPending}
          >
            {create.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
