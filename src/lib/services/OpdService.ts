import { Database } from '../db';
import type { Department, FlatDoctor, OpdData } from '../types';

/**
 * OpdService — business logic layer.
 * Reads data via Database, applies transformations, exposes clean query methods.
 * Server-side only.
 */
export class OpdService {
  /** Return the raw OPD dataset. */
  static getData(): OpdData {
    return Database.read();
  }

  /** Return all departments. */
  static getAllDepartments(): Department[] {
    return this.getData().departments;
  }

  /** Find a single department by its slug id. */
  static getDepartmentById(id: string): Department | undefined {
    return this.getAllDepartments().find((d) => d.id === id);
  }

  /**
   * Flatten all doctors across all departments into a single array,
   * embedding department metadata into each doctor record.
   */
  static getAllFlatDoctors(): FlatDoctor[] {
    const data = this.getData();
    return data.departments.flatMap((dept) =>
      dept.doctors.map((doctor) => ({
        ...doctor,
        departmentId: dept.id,
        departmentName: dept.name,
        departmentFloor: dept.floor,
        departmentColor: dept.color,
      }))
    );
  }

  /** Return only doctors currently in a 'running' consultation. */
  static getRunningConsultations(): FlatDoctor[] {
    return this.getAllFlatDoctors().filter(
      (d) => d.status === 'running' && d.currentToken !== null
    );
  }
}
